import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { XLSX_TYPE } from '../../core/reports/documents';
import { AnalyticsService } from './analytics.service';

function send(res: Response, file: Buffer, type: 'pdf' | 'xlsx', name: string) {
  res.setHeader('Content-Type', type === 'pdf' ? 'application/pdf' : XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${name}.${type}"`);
  res.send(file);
}

@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Roles('teacher', 'admin', 'directivo')
  @Get('analytics/courses/:id')
  course(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.analytics.course(user, id);
  }

  @Roles('admin', 'directivo')
  @Get('analytics/institution')
  institution() {
    return this.analytics.institution();
  }

  @Roles('teacher', 'admin', 'directivo', 'student', 'guardian')
  @Get('reports/bulletin/:userId/pdf')
  async bulletin(@CurrentUser() user: AuthUser, @Param('userId') userId: string, @Res() res: Response) {
    send(res, await this.analytics.bulletin(user, userId), 'pdf', 'boletin');
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/courses/:id/excel')
  async courseExcel(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    send(res, await this.analytics.courseExcel(user, id), 'xlsx', 'curso');
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/assessments/:id/excel')
  async assessment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response) {
    send(res, await this.analytics.assessmentExcel(user, id), 'xlsx', 'resultados');
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/integrity/:courseId/pdf')
  async integrityPdf(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string, @Res() res: Response) {
    send(res, await this.analytics.integrityPdf(user, courseId), 'pdf', 'integridad');
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/integrity/:courseId/excel')
  async integrityExcel(@CurrentUser() user: AuthUser, @Param('courseId') courseId: string, @Res() res: Response) {
    send(res, await this.analytics.integrityExcel(user, courseId), 'xlsx', 'integridad');
  }

  @Roles('admin', 'directivo')
  @Get('reports/usage/excel')
  async usage(@CurrentUser() user: AuthUser, @Query('days') days: string | undefined, @Res() res: Response) {
    const span = Math.min(365, Math.max(1, Number(days) || 30));
    send(res, await this.analytics.usageExcel(user, span), 'xlsx', 'uso-biblioteca-ia');
  }

  @Roles('admin', 'directivo')
  @Get('reports/roster/excel')
  async roster(@CurrentUser() user: AuthUser, @Res() res: Response) {
    send(res, await this.analytics.rosterExcel(user), 'xlsx', 'usuarios');
  }
}
