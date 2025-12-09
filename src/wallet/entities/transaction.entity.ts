import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Wallet } from './wallet.entity';

export enum TransactionType {
    DEPOSIT = 'deposit',
    TRANSFER = 'transfer',
}

export enum TransactionStatus {
    PENDING = 'pending',
    SUCCESS = 'success',
    FAILED = 'failed',
}

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Wallet, (wallet) => wallet.transactions)
    @JoinColumn({ name: 'wallet_id' })
    wallet: Wallet;

    @Column()
    wallet_id: string;

    @Column({ type: 'enum', enum: TransactionType })
    type: TransactionType;

    @Column('decimal', { precision: 15, scale: 2 })
    amount: number;

    @Column({ unique: true, nullable: true })
    reference: string; // Paystack reference or internal ID

    @Column({ type: 'enum', enum: TransactionStatus, default: TransactionStatus.PENDING })
    status: TransactionStatus;

    @Column({ type: 'jsonb', nullable: true })
    metadata: any; // Store sender/receiver info etc.

    @CreateDateColumn()
    created_at: Date;
}
