import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { dataRequestSchema, legalAcceptSchema, resolveDataRequestSchema } from '@eduquest/contracts';
import { AllowPendingPassword, CurrentUser, Public, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { clientInfo } from '../../core/auth/session-cookies';
import { ZodPipe } from '../../core/common/zod.pipe';
import { LegalService } from './legal.service';

@Controller()
export class LegalController {
  constructor(private readonly legal: LegalService) {}

  @Public()
  @Get('legal/documents')
  documents() {
    return this.legal.documents();
  }

  @AllowPendingPassword()
  @Get('legal/status')
  status(@CurrentUser() user: AuthUser) {
    return this.legal.status(user);
  }

  @AllowPendingPassword()
  @HttpCode(200)
  @Post('legal/accept')
  accept(@CurrentUser() user: AuthUser, @Body(new ZodPipe(legalAcceptSchema)) body: z.infer<typeof legalAcceptSchema>, @Req() req: Request) {
    return this.legal.accept(user, body, clientInfo(req).ip);
  }

  @Get('me/data-requests')
  myRequests(@CurrentUser() user: AuthUser) {
    return this.legal.myRequests(user);
  }

  @Post('me/data-requests')
  request(@CurrentUser() user: AuthUser, @Body(new ZodPipe(dataRequestSchema)) body: z.infer<typeof dataRequestSchema>) {
    return this.legal.requestDeletion(user, body.reason);
  }

  @Get('me/export')
  async export(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const data = await this.legal.export(user);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="mis-datos-ludoteka.json"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(JSON.stringify(data, null, 2));
  }

  @Roles('admin')
  @Get('admin/data-requests')
  adminRequests() {
    return this.legal.adminRequests();
  }

  @Roles('admin')
  @Patch('admin/data-requests/:id')
  resolve(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(resolveDataRequestSchema)) body: z.infer<typeof resolveDataRequestSchema>) {
    return this.legal.resolve(user, id, body.status);
  }
}
