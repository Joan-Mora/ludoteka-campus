import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Roles } from '../../core/auth/auth.decorators';
import { AnalyticsService } from './analytics.service';

@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Roles('teacher', 'admin', 'directivo')
  @Get('analytics/courses/:id')
  course(@Param('id') id: string) {
    return this.analytics.course(id);
  }

  @Roles('admin', 'directivo')
  @Get('analytics/institution')
  institution() {
    return this.analytics.institution();
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/bulletin/:userId/pdf')
  async bulletin(@Param('userId') userId: string, @Res() res: Response) {
    const file = await this.analytics.bulletin(userId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="boletin.pdf"');
    res.send(file);
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/assessments/:id/excel')
  async assessment(@Param('id') id: string, @Res() res: Response) {
    const file = await this.analytics.assessmentExcel(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="resultados.xlsx"');
    res.send(file);
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/integrity/:courseId/pdf')
  async integrityPdf(@Param('courseId') courseId: string, @Res() res: Response) {
    const file = await this.analytics.integrityPdf(courseId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="integridad.pdf"');
    res.send(file);
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('reports/integrity/:courseId/excel')
  async integrityExcel(@Param('courseId') courseId: string, @Res() res: Response) {
    const file = await this.analytics.integrityExcel(courseId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="integridad.xlsx"');
    res.send(file);
  }

  @Roles('admin', 'directivo')
  @Get('reports/roster/excel')
  async roster(@Res() res: Response) {
    const file = await this.analytics.rosterExcel();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="usuarios.xlsx"');
    res.send(file);
  }
}
