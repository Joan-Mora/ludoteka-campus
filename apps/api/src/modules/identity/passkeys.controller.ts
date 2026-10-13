import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { passkeyRenameSchema, passkeyVerifySchema } from '@eduquest/contracts';
import { Env } from '../../core/config/config.module';
import { CurrentUser, Public, type AuthUser } from '../../core/auth/auth.decorators';
import { clientInfo, REFRESH_COOKIE, setRefreshCookie } from '../../core/auth/session-cookies';
import { ZodPipe } from '../../core/common/zod.pipe';
import { AuthThrottleGuard } from '../../core/security/throttle';
import { IdentityService } from './identity.service';
import { PasskeysService } from './passkeys.service';

interface VerifyBody<T> {
  challengeId: string;
  response: T;
}

@Controller('auth')
export class PasskeysController {
  constructor(
    private readonly passkeys: PasskeysService,
    private readonly identity: IdentityService,
    private readonly env: Env,
  ) {}

  @Get('passkeys')
  list(@CurrentUser() user: AuthUser) {
    return this.passkeys.list(user);
  }

  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('passkey/register/options')
  registerOptions(@CurrentUser() user: AuthUser) {
    return this.passkeys.registerOptions(user);
  }

  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('passkey/register/verify')
  registerVerify(@CurrentUser() user: AuthUser, @Body(new ZodPipe(passkeyVerifySchema)) body: VerifyBody<RegistrationResponseJSON>, @Req() req: Request) {
    return this.passkeys.registerVerify(user, body.challengeId, body.response, clientInfo(req));
  }

  @Patch('passkeys/:id')
  rename(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(passkeyRenameSchema)) body: { label: string }) {
    return this.passkeys.rename(user, id, body.label);
  }

  @Delete('passkeys/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.passkeys.remove(user, id);
  }

  @Public()
  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('passkey/login/options')
  loginOptions() {
    return this.passkeys.loginOptions();
  }

  @Public()
  @HttpCode(200)
  @UseGuards(AuthThrottleGuard)
  @Post('passkey/login/verify')
  async loginVerify(
    @Body(new ZodPipe(passkeyVerifySchema)) body: VerifyBody<AuthenticationResponseJSON>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const session = await this.passkeys.loginVerify(body.challengeId, body.response, clientInfo(req));
    await this.identity.keepBrowserAccount(req.cookies?.[REFRESH_COOKIE], session);
    setRefreshCookie(res, this.env.values, session.refreshToken);
    return { accessToken: session.accessToken, user: session.user };
  }
}
