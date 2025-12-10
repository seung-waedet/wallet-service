import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac } from 'crypto';

@Injectable()
export class PaystackService {
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.secretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY')!;
    this.baseUrl =
      this.configService.get<string>('PAYSTACK_BASE_URL') ||
      'https://api.paystack.co';
  }

  async initializeTransaction(
    email: string,
    amount: number,
    reference: string,
  ) {
    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email,
          amount: amount * 100, // Paystack expects kobo
          reference,
          currency: 'NGN',
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data?.message || 'Paystack initialization failed',
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  async verifyTransaction(reference: string) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
          },
        },
      );
      return response.data.data;
    } catch (error: any) {
      throw new HttpException(
        error.response?.data?.message || 'Paystack verification failed',
        error.response?.status || HttpStatus.BAD_REQUEST,
      );
    }
  }

  verifyWebhookSignature(signature: string, body: any): boolean {
    const hash = createHmac('sha512', this.secretKey)
      .update(JSON.stringify(body))
      .digest('hex');
    return hash === signature;
  }
}
