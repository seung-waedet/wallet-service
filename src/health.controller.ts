import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('/kaithhealthcheck')
  healthCheck() {
    return { status: 'OK' };
  }

  @Get('/kaithheathcheck')
  healthCheckTypo() {
    return { status: 'OK' };
  }
}
