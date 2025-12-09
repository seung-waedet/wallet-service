import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class DepositDto {
  @ApiProperty({
    description: 'The amount to deposit into the wallet',
    example: 5000,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
