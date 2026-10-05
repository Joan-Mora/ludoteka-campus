import { Controller, Get } from '@nestjs/common';
import { Public } from '../../core/auth/auth.decorators';
import { DatabaseService } from '../../core/database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Public()
  @Get()
  async get() {
    await this.database.ping();
    return { ok: true, service: 'ludoteka-campus', db: 'up' };
  }
}
