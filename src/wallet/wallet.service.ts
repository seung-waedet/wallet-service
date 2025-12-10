import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import {
  Transaction,
  TransactionStatus,
  TransactionType,
} from './entities/transaction.entity';
import { User } from '../users/entities/user.entity';
import { PaystackService } from '../paystack/paystack.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private paystackService: PaystackService,
    private dataSource: DataSource,
  ) {}

  async createWallet(user: User) {
    this.logger.log(`Attempting to create wallet for user ${user.id}`);
    // Simple random 10 digit number
    const wallet_number = Math.floor(
      1000000000 + Math.random() * 9000000000,
    ).toString();
    const wallet = this.walletRepository.create({
      user,
      user_id: user.id,
      wallet_number,
    });
    const savedWallet = await this.walletRepository.save(wallet);
    this.logger.log(
      `Successfully created wallet ${savedWallet.wallet_number} for user ${user.id}`,
    );
    return savedWallet;
  }

  async getBalance(userId: string) {
    let wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });
    if (!wallet) {
      // Create wallet automatically if it doesn't exist
      const user = { id: userId } as User; // Create minimal user object
      wallet = await this.createWallet(user);
    }
    return { balance: wallet.balance };
  }

  async getTransactions(userId: string) {
    let wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
      relations: ['transactions'],
    });
    if (!wallet) {
      // Create wallet automatically if it doesn't exist
      const user = { id: userId } as User; // Create minimal user object
      wallet = await this.createWallet(user);
    }
    return wallet.transactions.sort(
      (a, b) => b.created_at.getTime() - a.created_at.getTime(),
    );
  }

  async initiateDeposit(userId: string, email: string, amount: number) {
    this.logger.log(`Initiating deposit of ${amount} for user ${userId}`);
    const reference = `dep_${uuidv4()}`;
    const paystackResponse = await this.paystackService.initializeTransaction(
      email,
      amount,
      reference,
    );

    const wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const transaction = this.transactionRepository.create({
      wallet,
      amount,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      reference,
      metadata: { authorization_url: paystackResponse.authorization_url },
    });

    await this.transactionRepository.save(transaction);
    this.logger.log(
      `Created PENDING deposit transaction ${transaction.id} for wallet ${wallet.id}`,
    );

    return {
      authorization_url: paystackResponse.authorization_url,
      reference,
      access_code: paystackResponse.access_code,
    };
  }

  async handlePaystackWebhook(signature: string, body: any) {
    this.logger.log(`Received Paystack webhook event: ${body.event}`);
    if (!this.paystackService.verifyWebhookSignature(signature, body)) {
      this.logger.error('Invalid Paystack webhook signature');
      throw new BadRequestException('Invalid signature');
    }
    this.logger.log('Paystack webhook signature verified successfully.');

    const event = body.event;
    const data = body.data;

    if (event === 'charge.success') {
      const reference = data.reference;
      const amountPaid = data.amount / 100; // Paystack sends kobo
      this.logger.log(
        `Processing successful charge for reference: ${reference}`,
      );

      const transaction = await this.transactionRepository.findOne({
        where: { reference },
        relations: ['wallet'],
      });

      if (!transaction) {
        this.logger.warn(
          `Webhook received for unknown transaction reference: ${reference}`,
        );
        return;
      }

      if (transaction.status === TransactionStatus.SUCCESS) {
        this.logger.log(
          `Transaction ${reference} has already been processed. Skipping.`,
        );
        return;
      }

      if (transaction.amount !== amountPaid) {
        this.logger.error(
          `Amount mismatch for ${reference}. Expected ${transaction.amount}, but Paystack reported ${amountPaid}`,
        );
        // Potentially update transaction to FAILED here
        return;
      }

      // Atomic Update
      await this.dataSource.transaction(async (manager) => {
        this.logger.log(
          `Starting atomic update for transaction ${transaction.id}`,
        );
        transaction.status = TransactionStatus.SUCCESS;
        transaction.metadata = { ...transaction.metadata, paystack_data: data };
        await manager.save(transaction);

        const wallet = await manager.findOne(Wallet, {
          where: { id: transaction.wallet.id },
        });
        if (wallet) {
          const newBalance = Number(wallet.balance) + amountPaid;
          this.logger.log(
            `Crediting wallet ${wallet.id}. Old balance: ${wallet.balance}, New balance: ${newBalance}`,
          );
          wallet.balance = newBalance;
          await manager.save(wallet);
        } else {
          this.logger.error(
            `Could not find wallet ${transaction.wallet.id} during transaction processing for reference ${reference}`,
          );
        }
      });
      this.logger.log(
        `Successfully processed deposit for reference ${reference}`,
      );
      return { status: true };
    }
    return { status: true }; // Acknowledge other events
  }

  async transferFunds(
    senderUserId: string,
    recipientWalletNumber: string,
    amount: number,
  ) {
    if (amount <= 0) {
      throw new BadRequestException('Transfer amount must be greater than 0');
    }
    this.logger.log(
      `Attempting transfer of ${amount} from user ${senderUserId} to wallet ${recipientWalletNumber}`,
    );

    const transferReference = `trf_${uuidv4()}`;
    await this.dataSource.transaction(async (manager) => {
      // 1. Get Sender Wallet (Locked)
      const senderWallet = await manager.findOne(Wallet, {
        where: { user_id: senderUserId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!senderWallet) throw new NotFoundException('Sender wallet not found');
      this.logger.debug(
        `Sender wallet ${senderWallet.id} found with balance ${senderWallet.balance}`,
      );

      if (Number(senderWallet.balance) < amount) {
        throw new BadRequestException('Insufficient funds');
      }

      // 2. Get Recipient Wallet
      const recipientWallet = await manager.findOne(Wallet, {
        where: { wallet_number: recipientWalletNumber },
      });

      if (!recipientWallet)
        throw new NotFoundException('Recipient wallet not found');
      if (recipientWallet.id === senderWallet.id) {
        throw new BadRequestException('Cannot transfer to self');
      }
      this.logger.debug(`Recipient wallet ${recipientWallet.id} found`);

      // 3. Deduct from Sender
      const senderNewBalance = Number(senderWallet.balance) - amount;
      this.logger.log(
        `Debiting sender ${senderWallet.id}. New balance will be ${senderNewBalance}`,
      );
      senderWallet.balance = senderNewBalance;
      await manager.save(senderWallet);

      // 4. Credit Recipient
      const recipientNewBalance = Number(recipientWallet.balance) + amount;
      this.logger.log(
        `Crediting recipient ${recipientWallet.id}. New balance will be ${recipientNewBalance}`,
      );
      recipientWallet.balance = recipientNewBalance;
      await manager.save(recipientWallet); // Note: using recipientWallet as it's the same object, no need to re-fetch

      // 5. Create Transactions
      this.logger.log(
        `Creating debit and credit transaction records with base reference ${transferReference}`,
      );
      const debitTx = manager.create(Transaction, {
        wallet: senderWallet,
        amount,
        type: TransactionType.TRANSFER,
        status: TransactionStatus.SUCCESS,
        reference: `${transferReference}_dr`,
        metadata: {
          direction: 'debit',
          counterparty_wallet: recipientWallet.wallet_number,
        },
      });

      const creditTx = manager.create(Transaction, {
        wallet: recipientWallet,
        amount,
        type: TransactionType.TRANSFER,
        status: TransactionStatus.SUCCESS,
        reference: `${transferReference}_cr`,
        metadata: {
          direction: 'credit',
          counterparty_wallet: senderWallet.wallet_number,
        },
      });

      await manager.save([debitTx, creditTx]);
      this.logger.log(
        `Saved transaction records for transfer ${transferReference}`,
      );
    });

    this.logger.log(`Transfer ${transferReference} completed successfully`);
    return { status: 'success', message: 'Transfer completed' };
  }
}
