import { Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { GamificationService } from './gamification.service';

@Controller('gamification')
export class GamificationController {
  constructor(private readonly game: GamificationService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.game.me(user.id);
  }

  @Roles('student')
  @Post('seen')
  seen(@CurrentUser() user: AuthUser) {
    return this.game.markSeen(user.id);
  }

  @Get('leaderboard')
  board(@Query('groupId') groupId: string) {
    return this.game.leaderboard(groupId);
  }
}
