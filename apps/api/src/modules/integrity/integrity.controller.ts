import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { integritySchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { IntegrityService } from './integrity.service';

@Controller()
export class IntegrityController {
  constructor(private readonly integrity: IntegrityService) {}

  @Roles('student')
  @Post('attempts/:id/integrity')
  record(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodPipe(integritySchema)) body: { type: 'fullscreen_exit' | 'visibility_hidden' | 'blur' | 'escape' },
  ) {
    return this.integrity.record(user, id, body.type);
  }

  @Roles('teacher', 'admin', 'directivo')
  @Get('courses/:id/integrity')
  events(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.integrity.courseEvents(user, id);
  }
}
