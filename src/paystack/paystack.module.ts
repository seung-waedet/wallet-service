import { Module } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { ConfigModule } from '@nestjs/config';

@Module({
    imports: [ConfigModule],
    providers: [PaystackService],
    exports: [PaystackService],
})
export class PaystackModule { }
