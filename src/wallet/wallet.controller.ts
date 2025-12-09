import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { HybridAuthGuard } from '../auth/guards/hybrid.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
  ApiHeader,
} from '@nestjs/swagger';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';

@ApiTags('Wallet')
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('balance')
  @UseGuards(HybridAuthGuard, PermissionsGuard)
  @Permissions('read')
  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({ status: 200, description: 'Returns the wallet balance.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Wallet not found.' })
  @ApiBearerAuth('JWT-auth')
  @ApiSecurity('ApiKeyAuth')
  getBalance(@Req() req) {
    return this.walletService.getBalance(req.user.id);
  }

  @Get('transactions')
  @UseGuards(HybridAuthGuard, PermissionsGuard)
  @Permissions('read')
  @ApiOperation({ summary: 'Get wallet transaction history' })
  @ApiResponse({ status: 200, description: 'Returns a list of transactions.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Wallet not found.' })
  @ApiBearerAuth('JWT-auth')
  @ApiSecurity('ApiKeyAuth')
  getTransactions(@Req() req) {
    return this.walletService.getTransactions(req.user.id);
  }

  @Post('deposit')
  @UseGuards(HybridAuthGuard, PermissionsGuard)
  @Permissions('deposit')
  @ApiOperation({ summary: 'Initiate a wallet deposit' })
  @ApiResponse({
    status: 201,
    description:
      'Returns a Paystack authorization URL to complete the deposit.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiBearerAuth('JWT-auth')
  @ApiSecurity('ApiKeyAuth')
  async deposit(@Req() req, @Body() depositDto: DepositDto) {
    return this.walletService.initiateDeposit(
      req.user.id,
      req.user.email,
      depositDto.amount,
    );
  }

  @Post('paystack/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Handle Paystack webhook events',
    description:
      'This endpoint is for receiving events from Paystack. It should not be called directly.',
  })
  @ApiHeader({
    name: 'x-paystack-signature',
    description: 'Paystack HMAC signature.',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook received and acknowledged.',
  })
  @ApiResponse({ status: 400, description: 'Invalid signature.' })
  async webhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any,
  ) {
    return this.walletService.handlePaystackWebhook(signature, body);
  }

  @Post('transfer')
  @UseGuards(HybridAuthGuard, PermissionsGuard)
  @Permissions('transfer')
  @ApiOperation({ summary: 'Transfer funds to another wallet' })
  @ApiResponse({ status: 201, description: 'Transfer completed successfully.' })
  @ApiResponse({
    status: 400,
    description: 'Insufficient funds or invalid recipient.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Wallet not found.' })
  @ApiBearerAuth('JWT-auth')
  @ApiSecurity('ApiKeyAuth')
  async transfer(@Req() req, @Body() transferDto: TransferDto) {
    return this.walletService.transferFunds(
      req.user.id,
      transferDto.wallet_number,
      transferDto.amount,
    );
  }
}
