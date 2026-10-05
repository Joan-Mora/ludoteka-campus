import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  enrollmentSchema,
  gradeSchema,
  groupSchema,
  subjectSchema,
  teachingSchema,
  yearSchema,
} from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { InstitutionService } from './institution.service';

@Controller('institution')
export class InstitutionController {
  constructor(private readonly institution: InstitutionService) {}

  @Roles('admin', 'directivo', 'teacher')
  @Get('years')
  years() {
    return this.institution.listYears();
  }

  @Roles('admin')
  @Post('years')
  createYear(@Body(new ZodPipe(yearSchema)) body: { name: string; startsOn: string; endsOn: string; isCurrent?: boolean }) {
    return this.institution.createYear(body);
  }

  @Roles('admin', 'directivo', 'teacher')
  @Get('grades')
  grades() {
    return this.institution.listGrades();
  }

  @Roles('admin')
  @Post('grades')
  createGrade(@Body(new ZodPipe(gradeSchema)) body: { level: number; name: string }) {
    return this.institution.createGrade(body);
  }

  @Roles('admin', 'directivo', 'teacher')
  @Get('groups')
  groups() {
    return this.institution.listGroups();
  }

  @Roles('admin')
  @Post('groups')
  createGroup(@Body(new ZodPipe(groupSchema)) body: { gradeId: string; academicYearId: string; name: string }) {
    return this.institution.createGroup(body);
  }

  @Roles('admin', 'directivo', 'teacher')
  @Get('subjects')
  subjects() {
    return this.institution.listSubjects();
  }

  @Roles('admin')
  @Post('subjects')
  createSubject(@Body(new ZodPipe(subjectSchema)) body: { code: string; name: string; area: string }) {
    return this.institution.createSubject(body);
  }

  @Roles('admin', 'directivo', 'teacher')
  @Get('enrollments')
  enrollments(@CurrentUser() user: AuthUser, @Query('groupId') groupId?: string) {
    return this.institution.listEnrollments(user, groupId || undefined);
  }

  @Roles('admin')
  @Post('enrollments')
  createEnrollment(@Body(new ZodPipe(enrollmentSchema)) body: { userId: string; groupId: string; academicYearId: string }) {
    return this.institution.createEnrollment(body);
  }

  @Roles('admin', 'directivo', 'teacher')
  @Get('teaching')
  teaching() {
    return this.institution.listTeaching();
  }

  @Roles('admin')
  @Post('teaching')
  createTeaching(
    @Body(new ZodPipe(teachingSchema))
    body: { teacherId: string; subjectId: string; groupId: string; academicYearId: string },
  ) {
    return this.institution.createTeaching(body);
  }

  @Roles('admin', 'directivo')
  @Get('overview')
  overview() {
    return this.institution.overview();
  }
}
