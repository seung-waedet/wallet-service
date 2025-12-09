import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class TransferDto {
  @ApiProperty({
    description: 'The 10-digit wallet number of the recipient',
    example: '1234567890',
  })
  @IsString()
  @Length(10, 10)
  wallet_number: string;

  @ApiProperty({
    description: 'The amount to transfer',
    example: 1000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
