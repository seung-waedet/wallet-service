import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiKeysService } from './api-keys.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiSecurity,
} from '@nestjs/swagger';
import { CreateApiKeyDto } from './dto/create-key.dto';
import { RolloverApiKeyDto } from './dto/rollover-key.dto';
import { ApiKeyResponseDto } from './dto/api-key-response.dto';

@ApiTags('API Keys')
@ApiBearerAuth('JWT-auth')
@Controller('keys')
@UseGuards(AuthGuard('jwt')) // Only logged in users can manage keys
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a new API key for the authenticated user' })
  @ApiResponse({
    status: 201,
    description: 'API key created successfully. The key is returned only once.',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({
    status: 400,
    description: 'Maximum number of active keys reached.',
  })
  async create(@Req() req, @Body() createApiKeyDto: CreateApiKeyDto) {
    return this.apiKeysService.create(
      req.user,
      createApiKeyDto.name,
      createApiKeyDto.permissions,
      createApiKeyDto.expiry,
    );
  }

  @Get('list')
  @ApiOperation({ summary: 'Get all API keys for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Returns a list of API keys for the user.',
    type: [ApiKeyResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiBearerAuth('JWT-auth')
  @ApiSecurity('ApiKeyAuth')
  async getApiKeys(@Req() req) {
    return this.apiKeysService.getApiKeysForUser(req.user.id);
  }

  @Post('rollover')
  @ApiOperation({
    summary: 'Rollover an expired API key to generate a new one',
  })
  @ApiResponse({
    status: 201,
    description: 'New API key created successfully from the expired key.',
  })
  @ApiResponse({ status: 400, description: 'Invalid or non-expired key ID.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async rollover(@Req() req, @Body() rolloverApiKeyDto: RolloverApiKeyDto) {
    return this.apiKeysService.rollover(
      req.user,
      rolloverApiKeyDto.expired_key_id,
      rolloverApiKeyDto.expiry,
    );
  }
}
