import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { learningActivitySchema, learningProfileSchema, type LearningMethod } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { LearningProfileService } from './profile.service';

@Controller()
export class LearningProfileController {
  constructor(private readonly profiles: LearningProfileService) {}

  @Roles('student')
  @Get('profile')
  status(@CurrentUser() user: AuthUser) {
    return this.profiles.status(user);
  }

  @Roles('student')
  @Post('profile')
  submit(@CurrentUser() user: AuthUser, @Body(new ZodPipe(learningProfileSchema)) body: { version: number; answers: number[] }) {
    return this.profiles.submit(user, body);
  }

  @Roles('student')
  @Post('profile/activity')
  activity(@CurrentUser() user: AuthUser, @Body(new ZodPipe(learningActivitySchema)) body: { method: LearningMethod; topicId?: string; resource?: string }) {
    return this.profiles.recordActivity(user, body);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Get('profile/courses/:id/distribution')
  distribution(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.profiles.courseDistribution(user, id);
  }
}
