import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/kaithheathcheck')
  healthCheck() {
    return { status: 'OK' };
  }
}
