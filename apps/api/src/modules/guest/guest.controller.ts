import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { CurrentUser, Public, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { clientInfo, setRefreshCookie } from '../../core/auth/session-cookies';
import { Env } from '../../core/config/config.module';
import { XLSX_TYPE } from '../../core/reports/documents';
import { GuestService } from './guest.service';
import type { Activity } from './guest.content';

@Controller()
export class GuestController {
  constructor(
    private readonly guest: GuestService,
    private readonly env: Env,
  ) {}

  @Roles('teacher', 'admin')
  @Get('clase/sesiones')
  list() {
    return this.guest.list();
  }

  @Roles('teacher', 'admin')
  @Post('clase/sesiones')
  open(@CurrentUser() user: AuthUser, @Body() body: { groupCode?: string }) {
    return this.guest.open(user, String(body.groupCode ?? ''));
  }

  @Roles('teacher', 'admin')
  @Get('clase/sesiones/:id')
  one(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.guest.one(id);
  }

  @Roles('teacher', 'admin')
  @Get('clase/sesiones/:id/tablero')
  board(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.guest.board(id);
  }

  @Roles('teacher', 'admin')
  @Patch('clase/sesiones/:id')
  activity(@Param('id', new ParseUUIDPipe()) id: string, @Body() body: { activity?: Activity }) {
    return this.guest.setActivity(id, body.activity ?? 'diagnostico');
  }

  @Roles('teacher', 'admin')
  @Post('clase/sesiones/:id/cerrar')
  close(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.guest.close(id);
  }

  @Roles('teacher', 'admin')
  @Get('clase/informe.xlsx')
  async export(@Query('ids') ids: string | undefined, @Query('from') from: string | undefined, @Query('to') to: string | undefined, @Res() res: Response) {
    const list = (ids ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    const file = await this.guest.export(list, from, to);
    res.setHeader('Content-Type', XLSX_TYPE);
    res.setHeader('Content-Disposition', 'attachment; filename="sesiones-invitados.xlsx"');
    res.send(file);
  }

  @Public()
  @Get('invitado/:code')
  lookup(@Param('code') code: string) {
    return this.guest.lookup(code);
  }

  @Public()
  @HttpCode(200)
  @Post('invitado/:code/entrar')
  async enter(@Param('code') code: string, @Body() body: { userId?: string; name?: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.guest.enter(code, body, clientInfo(req));
    setRefreshCookie(res, this.env.values, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Roles('student')
  @Get('clase/mia')
  mine(@CurrentUser() user: AuthUser) {
    return this.guest.mine(user);
  }

  @Roles('student')
  @Post('clase/diagnostico')
  diagnostic(@CurrentUser() user: AuthUser, @Body() body: { picks?: Record<string, string>; save?: boolean }) {
    const picks = body.picks ?? {};
    return body.save ? this.guest.saveDiagnostic(user, picks) : this.guest.answerDiagnostic(user, picks);
  }

  @Roles('student')
  @Post('clase/fabrica')
  factory(@CurrentUser() user: AuthUser, @Body() body: { choice?: string }) {
    return this.guest.answerFactory(user, String(body.choice ?? ''));
  }

  @Roles('student')
  @Post('clase/casos')
  cases(@CurrentUser() user: AuthUser, @Body() body: { picks?: Record<string, string> }) {
    return this.guest.answerCases(user, body.picks ?? {});
  }

  @Roles('student')
  @Get('clase/pareja')
  pair(@CurrentUser() user: AuthUser) {
    return this.guest.pair(user);
  }

  @Roles('student')
  @Post('clase/pareja')
  sit(@CurrentUser() user: AuthUser, @Body() body: { pairId?: string }) {
    return this.guest.sit(user, body.pairId);
  }

  @Roles('student')
  @Post('clase/pareja/respuesta')
  lock(@CurrentUser() user: AuthUser, @Body() body: { choice?: string }) {
    return this.guest.lock(user, String(body.choice ?? ''));
  }
}
