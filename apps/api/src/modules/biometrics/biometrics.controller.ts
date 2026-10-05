import { Body, Controller, Delete, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { facialConsentSchema, facialEnrollSchema, facialLoginSchema, guardianConsentSchema } from '@eduquest/contracts';
import type { ZodType } from 'zod';
import { Env } from '../../core/config/config.module';
import { CurrentUser, Public, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { rejectImageFields, ZodPipe } from '../../core/common/zod.pipe';
import { ApiError } from '../../core/errors/api-error';
import { BiometricsService } from './biometrics.service';
import { IdentityService } from '../identity/public-api';

function parseBody<T>(schema: ZodType<T, any, any>, body: unknown): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new ApiError(400, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Datos inválidos');
  }
  return parsed.data;
}

function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || undefined;
}

@Controller('facial')
export class BiometricsController {
  constructor(
    private readonly facial: BiometricsService,
    private readonly identity: IdentityService,
    private readonly env: Env,
  ) {}

  @Get('consent')
  status(@CurrentUser() user: AuthUser) {
    return this.facial.status(user.id);
  }

  @Post('consent')
  consent(@CurrentUser() user: AuthUser, @Body(new ZodPipe(facialConsentSchema)) _body: { accepted: true }) {
    return this.facial.consent(user);
  }

  @Public()
  @Post('challenge')
  challenge() {
    return this.facial.issueChallenge();
  }

  @Post('enroll')
  enroll(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    rejectImageFields(body);
    const parsed = parseBody(facialEnrollSchema, body);
    return this.facial.enroll(user, parsed, clientIp(req));
  }

  @Delete('enroll')
  remove(@CurrentUser() user: AuthUser) {
    return this.facial.remove(user.id);
  }

  @Get('attempts')
  attempts(@CurrentUser() user: AuthUser) {
    return this.facial.attempts(user.id);
  }

  @Public()
  @Post('login')
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    rejectImageFields(body);
    const parsed = parseBody(facialLoginSchema, body);
    const session = await this.facial.login(parsed, clientIp(req));
    res.cookie('eq_refresh', session.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.env.values.NODE_ENV === 'production',
      path: '/api/auth',
      maxAge: 14 * 24 * 3600 * 1000,
    });
    return { accessToken: session.accessToken, user: session.user, distance: Number(session.distance.toFixed(3)) };
  }

  @Roles('admin', 'directivo')
  @Post('guardian-consent')
  guardian(@CurrentUser() actor: AuthUser, @Body(new ZodPipe(guardianConsentSchema)) body: { userId: string }) {
    return this.identity.setGuardianConsent(body.userId, actor.id);
  }
}
