import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { preferencesSchema } from '@eduquest/contracts';
import { CurrentUser, type AuthUser } from '../../core/auth/auth.decorators';
import { REFRESH_COOKIE } from '../../core/auth/session-cookies';
import { ZodPipe } from '../../core/common/zod.pipe';
import { SettingsService } from './settings.service';

@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('me/preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.settings.preferences(user);
  }

  @Put('me/preferences')
  savePreferences(@CurrentUser() user: AuthUser, @Body(new ZodPipe(preferencesSchema)) body: z.infer<typeof preferencesSchema>) {
    return this.settings.savePreferences(user, body);
  }

  @Get('auth/sessions')
  sessions(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.settings.sessions(user, req.cookies?.[REFRESH_COOKIE]);
  }

  @Delete('auth/sessions/:id')
  closeSession(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.settings.closeSession(user, id);
  }

  @Get('auth/devices')
  devices(@CurrentUser() user: AuthUser) {
    return this.settings.devices(user);
  }

  @Delete('auth/devices/:id')
  forgetDevice(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.settings.forgetDevice(user, id);
  }
}
