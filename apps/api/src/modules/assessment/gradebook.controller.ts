import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { attendanceSchema, gradeCategoriesSchema, riskAlertUpdateSchema, rubricScoreSchema, rubricSchema, type GradeSource } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { XLSX_TYPE } from '../../core/reports/documents';
import { GradebookService } from './gradebook.service';

function send(res: Response, file: Buffer, type: 'pdf' | 'xlsx', name: string) {
  res.setHeader('Content-Type', type === 'pdf' ? 'application/pdf' : XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${name}.${type}"`);
  res.send(file);
}

/** Coordinación y rectoría consultan; solo el docente del curso y la administración escriben. */
@Roles('teacher', 'admin', 'coordinator', 'rector')
@Controller('gradebook')
export class GradebookController {
  constructor(private readonly gradebook: GradebookService) {}

  @Get('courses/:id')
  book(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gradebook.gradebook(user, id);
  }

  @Roles('teacher', 'admin')
  @Put('courses/:id/categories')
  categories(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(gradeCategoriesSchema)) body: { categories: { name: string; source: GradeSource; weight: number }[] }) {
    return this.gradebook.saveCategories(user, id, body.categories);
  }

  @Get('courses/:id/attendance')
  attendance(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('date') date?: string) {
    return this.gradebook.attendanceSheet(user, id, date);
  }

  @Roles('teacher', 'admin')
  @Put('courses/:id/attendance')
  saveAttendance(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(attendanceSchema)) body: { date: string; entries: { studentId: string; status: string; note?: string }[] }) {
    return this.gradebook.saveAttendance(user, id, body);
  }

  @Get('courses/:id/rubrics')
  rubrics(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gradebook.rubrics(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('courses/:id/rubrics')
  createRubric(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(rubricSchema)) body: { title: string; assignmentId?: string; criteria: { name: string; description?: string; maxPoints: number }[] }) {
    return this.gradebook.createRubric(user, id, body);
  }

  @Roles('teacher', 'admin')
  @Delete('rubrics/:id')
  deleteRubric(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gradebook.deleteRubric(user, id);
  }

  @Roles('teacher', 'admin')
  @Put('rubrics/:id/scores')
  score(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(rubricScoreSchema)) body: { studentId: string; scores: { criterionId: string; points: number; comment?: string }[] }) {
    return this.gradebook.scoreRubric(user, id, body);
  }

  @Get('courses/:id/alerts')
  alerts(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.gradebook.alerts(user, id);
  }

  @Roles('teacher', 'admin', 'coordinator')
  @Patch('alerts/:id')
  updateAlert(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(riskAlertUpdateSchema)) body: { status: 'acknowledged' | 'resolved' }) {
    return this.gradebook.updateAlert(user, id, body.status);
  }

  @Get('courses/:id/report/excel')
  async excel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    send(res, await this.gradebook.reportExcel(user, id), 'xlsx', 'calificaciones');
  }

  @Get('courses/:id/report/pdf')
  async pdf(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    send(res, await this.gradebook.reportPdf(user, id), 'pdf', 'calificaciones');
  }
}
