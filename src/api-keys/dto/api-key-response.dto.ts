import { ApiProperty } from '@nestjs/swagger';

export class ApiKeyResponseDto {
  @ApiProperty({
    description: 'The UUID of the API key',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  id: string;

  @ApiProperty({
    description: 'The permissions associated with this API key',
    example: ['read', 'deposit'],
    type: [String],
  })
  permissions: string[];

  @ApiProperty({
    description: 'The expiration date of the API key',
    example: '2025-01-01T12:00:00Z',
  })
  expires_at: Date;

  @ApiProperty({
    description: 'Whether the API key is currently active',
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'The creation date of the API key',
    example: '2024-12-10T12:00:00Z',
  })
  created_at: Date;
}
