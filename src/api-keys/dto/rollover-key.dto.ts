import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class RolloverApiKeyDto {
  @ApiProperty({
    description: 'The ID of the expired key you want to roll over',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsUUID()
  expired_key_id: string;

  @ApiProperty({
    description: 'The expiry period for the new key (e.g., "30D" for 30 days, "1Y" for 1 year)',
    example: '90D',
  })
  @IsString()
  @IsNotEmpty()
  expiry: string;
}
