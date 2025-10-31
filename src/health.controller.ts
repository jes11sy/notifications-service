import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get('api/health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'notifications-service',
    };
  }
}

