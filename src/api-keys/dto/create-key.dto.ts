import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString, IsNotEmpty } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'A friendly name for the API key',
    example: 'My Production Key',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'A list of permissions for the key (e.g., "read", "deposit", "transfer")',
    example: ['read', 'deposit'],
  })
  @IsArray()
  @IsString({ each: true })
  permissions: string[];

  @ApiProperty({
    description: 'The expiry period for the key (e.g., "30D" for 30 days, "1Y" for 1 year)',
    example: '90D',
  })
  @IsString()
  @IsNotEmpty()
  expiry: string;
}
