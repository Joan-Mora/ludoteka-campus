import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { arenaControlSchema, arenaCreateSchema, arenaJoinSchema, arenaOptionSchema, type ArenaAction } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { ArenaService } from './arena.service';

@Controller('arena')
export class ArenaController {
  constructor(private readonly arena: ArenaService) {}

  @Roles('student', 'teacher', 'admin', 'directivo')
  @Get('rooms')
  list(@CurrentUser() user: AuthUser) {
    return this.arena.list(user);
  }

  @Roles('teacher', 'admin')
  @Post('rooms')
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(arenaCreateSchema)) body: { courseId: string; title?: string; assessmentId?: string; count?: number; teamSize?: number; questionSec?: number },
  ) {
    return this.arena.create(user, body);
  }

  @Roles('student')
  @Post('join')
  join(@CurrentUser() user: AuthUser, @Body(new ZodPipe(arenaJoinSchema)) body: { code: string }) {
    return this.arena.join(user, body.code);
  }

  @Roles('student', 'teacher', 'admin', 'directivo')
  @Get('rooms/:id')
  state(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.arena.state(user, id);
  }

  @Roles('student')
  @Post('rooms/:id/vote')
  vote(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(arenaOptionSchema)) body: { optionId: string }) {
    return this.arena.vote(user, id, body.optionId);
  }

  @Roles('student')
  @Post('rooms/:id/lock')
  lock(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(arenaOptionSchema)) body: { optionId: string }) {
    return this.arena.lock(user, id, body.optionId);
  }

  @Roles('student')
  @Post('rooms/:id/command')
  command(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.arena.takeCommand(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('rooms/:id/control')
  control(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(arenaControlSchema)) body: { action: ArenaAction }) {
    return this.arena.control(user, id, body.action);
  }
}
