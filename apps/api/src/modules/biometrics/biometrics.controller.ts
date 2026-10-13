import { Body, Controller, Delete, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { facialConsentSchema, facialEnrollSchema, facialLoginSchema, guardianConsentSchema } from '@eduquest/contracts';
import type { ZodType } from 'zod';
import { Env } from '../../core/config/config.module';
import { CurrentUser, Public, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { rejectImageFields, ZodPipe } from '../../core/common/zod.pipe';
import { AuthThrottleGuard } from '../../core/security/throttle';
import { ApiError } from '../../core/errors/api-error';
import { REFRESH_COOKIE, requireVerifiedSession, setRefreshCookie } from '../../core/auth/session-cookies';
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
  @UseGuards(AuthThrottleGuard)
  @Post('challenge')
  challenge() {
    return this.facial.issueChallenge();
  }

  @UseGuards(AuthThrottleGuard)
  @Post('enroll')
  enroll(@CurrentUser() user: AuthUser, @Body() body: unknown, @Req() req: Request) {
    requireVerifiedSession(user);
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
  @UseGuards(AuthThrottleGuard)
  @Post('login')
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    rejectImageFields(body);
    const parsed = parseBody(facialLoginSchema, body);
    const session = await this.facial.login(parsed, clientIp(req));
    await this.identity.keepBrowserAccount(req.cookies?.[REFRESH_COOKIE], session);
    setRefreshCookie(res, this.env.values, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user, distance: Number(session.distance.toFixed(3)) };
  }

  @Roles('admin', 'coordinator')
  @Post('guardian-consent')
  guardian(@CurrentUser() actor: AuthUser, @Body(new ZodPipe(guardianConsentSchema)) body: { userId: string }) {
    return this.identity.setGuardianConsent(body.userId, actor.id);
  }
}
