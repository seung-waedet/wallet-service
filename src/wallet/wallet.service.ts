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
    // Convert amount to kobo (multiply by 100)
    const amountInKobo = Math.round(amount * 100);
    this.logger.log(
      `Initiating deposit of ${amountInKobo} kobo (${amount} naira) for user ${userId}`,
    );
    const reference = `dep_${uuidv4()}`;
    const paystackResponse = await this.paystackService.initializeTransaction(
      email,
      amountInKobo, // Send amount in kobo to Paystack
      reference,
    );

    const wallet = await this.walletRepository.findOne({
      where: { user_id: userId },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const transaction = this.transactionRepository.create({
      wallet,
      amount: amountInKobo, // Store amount in kobo
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      reference,
      metadata: { authorization_url: paystackResponse.authorization_url },
    });

    await this.transactionRepository.save(transaction);
    this.logger.log(
      `Created PENDING deposit transaction ${transaction.id} for wallet ${wallet.id} with amount ${amountInKobo} kobo`,
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
      // Paystack sends amount in kobo - keep it as kobo for comparison
      const amountPaidInKobo = data.amount;
      this.logger.log(
        `Processing successful charge for reference: ${reference}, amount: ${amountPaidInKobo} kobo`,
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

      // Convert both to numbers for comparison to handle type differences
      const expectedAmount = Number(transaction.amount);
      const reportedAmount = Number(amountPaidInKobo);

      if (expectedAmount !== reportedAmount) {
        this.logger.error(
          `Amount mismatch for ${reference}. Expected ${expectedAmount} kobo, but Paystack reported ${reportedAmount} kobo`,
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
          // Calculate new balance in kobo, then convert back to naira
          const walletBalanceInKobo = Math.round(Number(wallet.balance) * 100);
          const newBalanceInKobo = walletBalanceInKobo + amountPaidInKobo;
          const newBalanceInNaira = newBalanceInKobo / 100;
          this.logger.log(
            `Crediting wallet ${wallet.id}. Old balance: ${wallet.balance}, New balance: ${newBalanceInNaira}`,
          );
          wallet.balance = newBalanceInNaira;
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
    // Convert amount to kobo (multiply by 100)
    const amountInKobo = Math.round(amount * 100);
    if (amountInKobo <= 0) {
      throw new BadRequestException('Transfer amount must be greater than 0');
    }
    this.logger.log(
      `Attempting transfer of ${amountInKobo} kobo (${amount} naira) from user ${senderUserId} to wallet ${recipientWalletNumber}`,
    );

    const transferReference = `trf_${uuidv4()}`;
    await this.dataSource.transaction(async (manager) => {
      // 1. Get Sender Wallet (Locked)
      const senderWallet = await manager.findOne(Wallet, {
        where: { user_id: senderUserId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!senderWallet) throw new NotFoundException('Sender wallet not found');
      // Convert balance to kobo for comparison
      const senderBalanceInKobo = Math.round(
        Number(senderWallet.balance) * 100,
      );
      this.logger.debug(
        `Sender wallet ${senderWallet.id} found with balance ${senderBalanceInKobo} kobo (${senderWallet.balance} naira)`,
      );

      if (senderBalanceInKobo < amountInKobo) {
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

      // 3. Deduct from Sender (in kobo)
      const senderBalanceInKoboAfter = senderBalanceInKobo - amountInKobo;
      const senderNewBalanceInNaira = senderBalanceInKoboAfter / 100;
      this.logger.log(
        `Debiting sender ${senderWallet.id}. New balance will be ${senderNewBalanceInNaira}`,
      );
      senderWallet.balance = senderNewBalanceInNaira;
      await manager.save(senderWallet);

      // 4. Credit Recipient (in kobo)
      const recipientBalanceInKobo = Math.round(
        Number(recipientWallet.balance) * 100,
      );
      const recipientBalanceInKoboAfter = recipientBalanceInKobo + amountInKobo;
      const recipientNewBalanceInNaira = recipientBalanceInKoboAfter / 100;
      this.logger.log(
        `Crediting recipient ${recipientWallet.id}. New balance will be ${recipientNewBalanceInNaira}`,
      );
      recipientWallet.balance = recipientNewBalanceInNaira;
      await manager.save(recipientWallet);

      // 5. Create Transactions (in kobo)
      this.logger.log(
        `Creating debit and credit transaction records with base reference ${transferReference}`,
      );
      const debitTx = manager.create(Transaction, {
        wallet: senderWallet,
        amount: amountInKobo, // Store amount in kobo
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
        amount: amountInKobo, // Store amount in kobo
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

  async getDepositStatus(reference: string) {
    const transaction = await this.transactionRepository.findOne({
      where: { reference },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    // Convert amount from kobo back to naira for the response
    const amountInNaira = transaction.amount / 100;

    return {
      reference: transaction.reference,
      status: transaction.status,
      amount: amountInNaira,
    };
  }
}
