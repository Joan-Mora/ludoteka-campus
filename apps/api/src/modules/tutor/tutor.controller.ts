import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { draftSchema, tutorChatSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { TutorService } from './tutor.service';

@Controller()
export class TutorController {
  constructor(private readonly tutor: TutorService) {}

  @Roles('student', 'teacher')
  @Post('tutor/chat')
  chat(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(tutorChatSchema))
    body: { message: string; courseId?: string; lessonId?: string; conversationId?: string },
  ) {
    return this.tutor.chat(user, body);
  }

  @Roles('teacher', 'admin')
  @Post('tutor/drafts')
  drafts(@CurrentUser() user: AuthUser, @Body(new ZodPipe(draftSchema)) body: { courseId: string; topic: string; count?: number }) {
    return this.tutor.drafts(user, body);
  }

  @Roles('teacher', 'admin')
  @Post('courses/:id/recommendations')
  recommend(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.tutor.recommend(user, id);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Get('courses/:id/recommendations')
  list(@Param('id') id: string) {
    return this.tutor.listRecommendations(id);
  }
}
