import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { minigameSchema } from '@eduquest/contracts';
import { CurrentUser, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly game: GamificationService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.game.me(user.id);
  }

  @Get('leaderboard')
  board(@Query('groupId') groupId: string) {
    return this.game.leaderboard(groupId);
  }

  @Post('minigames')
  play(@CurrentUser() user: AuthUser, @Body(new ZodPipe(minigameSchema)) body: { game: 'carrera' | 'fracciones'; score: number }) {
    return this.game.recordMinigame(user.id, body.game, body.score);
  }
}
