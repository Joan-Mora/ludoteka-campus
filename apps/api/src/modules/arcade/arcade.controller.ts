import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { arcadeAnswerSchema, arcadeStartSchema, type ArcadeGame } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { ArcadeService } from './arcade.service';

@Roles('student')
@Controller('arcade')
export class ArcadeController {
  constructor(private readonly arcade: ArcadeService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.arcade.overview(user);
  }

  @Get('ranking')
  ranking(@CurrentUser() user: AuthUser, @Query('scope') scope?: string) {
    return this.arcade.ranking(user, scope === 'daily' ? 'daily' : 'week');
  }

  @Post('sessions')
  start(@CurrentUser() user: AuthUser, @Body(new ZodPipe(arcadeStartSchema)) body: { game: ArcadeGame; topicId?: string; daily?: boolean }) {
    return this.arcade.start(user, body);
  }

  @Post('sessions/:id/answer')
  answer(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(arcadeAnswerSchema)) body: { index: number; answer: string }) {
    return this.arcade.answer(user, id, body);
  }

  @Post('sessions/:id/finish')
  finish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.arcade.finish(user, id);
  }
}
