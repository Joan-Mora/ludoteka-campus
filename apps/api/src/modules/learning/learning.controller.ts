import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  announcementSchema,
  assignmentSchema,
  courseSchema,
  eventSchema,
  gradeSchemaSubmission,
  lessonSchema,
  submissionSchema,
  unitSchema,
} from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { LearningService } from './learning.service';

@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('courses')
  list(@CurrentUser() user: AuthUser) {
    return this.learning.list(user);
  }

  @Get('home/feed')
  feed(@CurrentUser() user: AuthUser) {
    return this.learning.homeFeed(user);
  }

  @Get('courses/:id')
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.learning.detail(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('courses')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(courseSchema)) body: { subjectId: string; groupId: string; academicYearId: string; title: string; description?: string }) {
    return this.learning.createCourse(user, body);
  }

  @Roles('teacher', 'admin')
  @Post('courses/:id/units')
  unit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(unitSchema)) body: { title: string; summary?: string }) {
    return this.learning.addUnit(user, id, body);
  }

  @Roles('teacher', 'admin')
  @Post('units/:id/lessons')
  lessonCreate(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(lessonSchema)) body: { title: string; bodyMd: string; estimatedMin?: number }) {
    return this.learning.addLesson(user, id, body);
  }

  @Get('lessons/:id')
  lesson(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.learning.lesson(user, id);
  }

  @Roles('student')
  @Post('lessons/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.learning.completeLesson(user, id);
  }

  @Get('courses/:id/assignments')
  assignments(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.learning.listAssignments(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('courses/:id/assignments')
  createAssignment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(assignmentSchema)) body: { title: string; instructions: string; dueAt?: string; maxScore?: number; lessonId?: string },
  ) {
    return this.learning.createAssignment(user, id, body);
  }

  @Roles('student')
  @Post('assignments/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(submissionSchema)) body: { body: string }) {
    return this.learning.submit(user, id, body.body);
  }

  @Roles('teacher', 'admin')
  @Post('submissions/:id/grade')
  grade(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(gradeSchemaSubmission)) body: { score: number; feedback?: string }) {
    return this.learning.grade(user, id, body);
  }

  @Get('courses/:id/announcements')
  announcements(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.learning.listAnnouncements(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('courses/:id/announcements')
  announce(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body(new ZodPipe(announcementSchema)) body: { title: string; body: string }) {
    return this.learning.announce(user, id, body);
  }

  @Get('courses/:id/events')
  events(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.learning.listEvents(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('courses/:id/events')
  addEvent(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(eventSchema)) body: { title: string; startsAt: string; endsAt?: string; kind?: 'class' | 'exam' | 'task' | 'event' },
  ) {
    return this.learning.addEvent(user, id, body);
  }
}
