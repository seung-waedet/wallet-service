import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class RolloverApiKeyDto {
  @ApiProperty({
    description: 'The ID of the expired key or the expired key itself',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsString()
  @IsNotEmpty()
  // Allow either UUID format or API key format (starting with sk_)
  @Matches(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^[a-zA-Z0-9_]+$/,
    {
      message:
        'expired_key_id must be either a valid UUID or an API key string',
    },
  )
  expired_key_id: string;

  @ApiProperty({
    description:
      'The expiry period for the new key (e.g., "30D" for 30 days, "1Y" for 1 year)',
    example: '90D',
  })
  @IsString()
  @IsNotEmpty()
  expiry: string;
}
