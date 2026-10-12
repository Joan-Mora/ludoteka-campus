import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { changePasswordSchema, forgotSchema, loginSchema, otpResendSchema, otpVerifySchema, resetSchema } from '@eduquest/contracts';
import { Env } from '../../core/config/config.module';
import { AllowPendingPassword, CurrentUser, Public, type AuthUser } from '../../core/auth/auth.decorators';
import { addDeviceToken, clearRefreshCookie, clientInfo, deviceTokens, REFRESH_COOKIE, setRefreshCookie } from '../../core/auth/session-cookies';
import { ZodPipe } from '../../core/common/zod.pipe';
import { AuthThrottleGuard } from '../../core/security/throttle';
import { IdentityService, TRUSTED_DAYS, type Session } from './identity.service';

@Controller()
export class IdentityController {
  constructor(
    private readonly identity: IdentityService,
    private readonly env: Env,
  ) {}

  private sendSession(res: Response, session: Session) {
    setRefreshCookie(res, this.env.values, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Public()
  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('auth/login')
  async login(@Body(new ZodPipe(loginSchema)) body: { email: string; password: string }, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.identity.login(body.email, body.password, clientInfo(req), deviceTokens(req));
    if (result.kind === 'otp') return { otp: result.otp };
    return this.sendSession(res, result.session);
  }

  @Public()
  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('auth/otp/verify')
  async verifyOtp(
    @Body(new ZodPipe(otpVerifySchema)) body: { challengeId: string; code: string; trustDevice?: boolean },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const client = clientInfo(req);
    const { userId, session } = await this.identity.verifyOtp(body.challengeId, body.code, client);
    if (body.trustDevice) addDeviceToken(req, res, this.env.values, await this.identity.trustDevice(userId, client), TRUSTED_DAYS);
    return this.sendSession(res, session);
  }

  @Public()
  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('auth/otp/resend')
  async resendOtp(@Body(new ZodPipe(otpResendSchema)) body: { challengeId: string }, @Req() req: Request) {
    return { otp: await this.identity.resendOtp(body.challengeId, clientInfo(req)) };
  }

  @Public()
  @HttpCode(200)
  @Post('auth/refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.sendSession(res, await this.identity.refresh(req.cookies?.[REFRESH_COOKIE], clientInfo(req)));
  }

  @Public()
  @HttpCode(200)
  @Post('auth/logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.identity.logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res, this.env.values);
    return { ok: true };
  }

  @AllowPendingPassword()
  @HttpCode(200)
  @Post('auth/logout-all')
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.identity.logoutEverywhere(user);
    clearRefreshCookie(res, this.env.values);
    return { ok: true };
  }

  @AllowPendingPassword()
  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('auth/password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePasswordSchema)) body: { currentPassword: string; newPassword: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.sendSession(res, await this.identity.changePassword(user, body.currentPassword, body.newPassword, clientInfo(req)));
  }

  @Public()
  @UseGuards(AuthThrottleGuard)
  @Post('auth/forgot')
  async forgot(@Body(new ZodPipe(forgotSchema)) body: { email: string }, @Res({ passthrough: true }) res: Response) {
    await this.identity.forgot(body.email);
    res.status(204);
  }

  @Public()
  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('auth/reset')
  async reset(@Body(new ZodPipe(resetSchema)) body: { token: string; password: string }) {
    await this.identity.reset(body.token, body.password);
    return { ok: true };
  }

  @AllowPendingPassword()
  @Get('auth/me')
  me(@CurrentUser() user: AuthUser) {
    return this.identity.me(user.id);
  }
}
