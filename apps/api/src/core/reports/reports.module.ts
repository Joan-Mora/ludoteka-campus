import { Controller, Get, Global, Module, Param } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/auth.decorators';
import { ReportLog } from './report-log.service';

@Controller()
class ReportLogController {
  constructor(private readonly reports: ReportLog) {}

  @Public()
  @Get('public/reports/:code')
  verify(@Param('code') code: string) {
    return this.reports.verify(code);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Get('reports/log')
  history(@CurrentUser() user: AuthUser) {
    return this.reports.history(user);
  }
}

@Global()
@Module({
  controllers: [ReportLogController],
  providers: [ReportLog],
  exports: [ReportLog],
})
export class ReportsModule {}
