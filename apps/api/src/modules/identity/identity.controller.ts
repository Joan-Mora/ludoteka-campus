import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  createUserSchema,
  forgotSchema,
  loginSchema,
  registerSchema,
  resetSchema,
} from '@eduquest/contracts';
import { Env } from '../../core/config/config.module';
import { CurrentUser, Public, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { IdentityService } from './identity.service';

function cookieOptions(env: Env) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.values.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: 14 * 24 * 3600 * 1000,
  };
}

@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly env: Env,
  ) {}

  private sendSession(res: Response, session: { accessToken: string; refreshToken: string; user: unknown }) {
    res.cookie('eq_refresh', session.refreshToken, cookieOptions(this.env));
    return { accessToken: session.accessToken, user: session.user };
  }

  @Public()
  @Post('auth/register')
  async register(@Body(new ZodPipe(registerSchema)) body: { email: string; password: string; fullName: string }, @Res({ passthrough: true }) res: Response) {
    return this.sendSession(res, await this.identity.register(body));
  }

  @Public()
  @Post('auth/login')
  async login(@Body(new ZodPipe(loginSchema)) body: { email: string; password: string }, @Res({ passthrough: true }) res: Response) {
    return this.sendSession(res, await this.identity.login(body.email, body.password));
  }

  @Public()
  @Post('auth/refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.sendSession(res, await this.identity.refresh(req.cookies?.eq_refresh));
  }

  @Public()
  @Post('auth/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.identity.logout(req.cookies?.eq_refresh);
    res.clearCookie('eq_refresh', { path: '/api/auth' });
    return { ok: true };
  }

  @Public()
  @Post('auth/forgot')
  async forgot(@Body(new ZodPipe(forgotSchema)) body: { email: string }, @Res({ passthrough: true }) res: Response) {
    await this.identity.forgot(body.email);
    res.status(204);
  }

  @Public()
  @Post('auth/reset')
  async reset(@Body(new ZodPipe(resetSchema)) body: { token: string; password: string }) {
    await this.identity.reset(body.token, body.password);
    return { ok: true };
  }

  @Get('auth/me')
  me(@CurrentUser() user: AuthUser) {
    return this.identity.me(user.id);
  }

  @Roles('admin')
  @Get('admin/users')
  list() {
    return this.identity.listUsers();
  }

  @Roles('admin')
  @Post('admin/users')
  create(@CurrentUser() actor: AuthUser, @Body(new ZodPipe(createUserSchema)) body: { email: string; password: string; fullName: string; role: AuthUser['role']; isMinor?: boolean }) {
    return this.identity.createUser(actor, body);
  }
}
