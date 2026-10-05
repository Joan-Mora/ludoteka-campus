import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { answerSchema, assessmentSchema, liveCreateSchema, liveJoinSchema, questionSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { AssessmentService } from './assessment.service';

@Controller()
export class AssessmentController {
  constructor(private readonly assessment: AssessmentService) {}

  @Roles('teacher', 'admin')
  @Get('questions')
  questions(@Query('subjectId') subjectId?: string) {
    return this.assessment.listQuestions(subjectId);
  }

  @Roles('teacher', 'admin')
  @Post('questions')
  createQuestion(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(questionSchema))
    body: { subjectId: string; gradeId?: string; prompt: string; difficulty?: 'baja' | 'media' | 'alta'; explanation?: string; options: { label: string; text: string; correct: boolean }[] },
  ) {
    return this.assessment.createQuestion(user, body);
  }

  @Roles('teacher', 'admin')
  @Post('questions/:id/active')
  active(@Param('id') id: string, @Body() body: { active?: boolean }) {
    return this.assessment.setActive(id, Boolean(body.active));
  }

  @Roles('teacher', 'admin')
  @Post('assessments')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(assessmentSchema))
    body: { courseId: string; title: string; kind: 'practice' | 'exam' | 'live'; timeLimitSec?: number; questionIds: string[] },
  ) {
    return this.assessment.createAssessment(user, body);
  }

  @Get('courses/:id/assessments')
  list(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessment.listForCourse(user, id);
  }

  @Roles('student')
  @Post('assessments/:id/start')
  start(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessment.start(user, id);
  }

  @Get('attempts/:id')
  attempt(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessment.getAttempt(user, id);
  }

  @Roles('student')
  @Post('attempts/:id/answers')
  answer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(answerSchema)) body: { questionId: string; optionId: string; elapsedMs?: number },
  ) {
    return this.assessment.answer(user, id, body);
  }

  @Roles('student')
  @Post('attempts/:id/submit')
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessment.submit(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('live')
  open(@CurrentUser() user: AuthUser, @Body(new ZodPipe(liveCreateSchema)) body: { assessmentId: string }) {
    return this.assessment.createLive(user, body.assessmentId);
  }

  @Post('live/join')
  join(@CurrentUser() user: AuthUser, @Body(new ZodPipe(liveJoinSchema)) body: { code: string }) {
    return this.assessment.joinLive(user, body.code);
  }

  @Get('live/:code')
  live(@Param('code') code: string) {
    return this.assessment.liveByCode(code);
  }

  @Roles('teacher', 'admin')
  @Post('live/:id/next')
  next(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.assessment.advanceLive(user, id);
  }

  @Roles('student')
  @Post('live/:id/answer')
  liveAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(answerSchema.pick({ questionId: true, optionId: true }))) body: { questionId: string; optionId: string },
  ) {
    return this.assessment.liveAnswer(user, id, body);
  }
}
