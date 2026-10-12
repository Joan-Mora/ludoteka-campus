import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { guardianAuthorizationSchema, guardianLinkSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { GuardiansService } from './guardians.service';

@Controller()
export class GuardiansController {
  constructor(private readonly guardians: GuardiansService) {}

  @Roles('guardian')
  @Get('guardian/students')
  students(@CurrentUser() user: AuthUser) {
    return this.guardians.myStudents(user);
  }

  @Roles('guardian')
  @Post('guardian/authorizations')
  authorize(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(guardianAuthorizationSchema)) body: z.infer<typeof guardianAuthorizationSchema>,
    @Req() req: Request,
  ) {
    return this.guardians.authorize(user, body, req.ip || req.socket.remoteAddress || null);
  }

  @Roles('admin', 'coordinator')
  @Get('admin/guardian-links')
  links() {
    return this.guardians.listLinks();
  }

  @Roles('admin', 'coordinator')
  @Post('admin/guardian-links')
  link(@CurrentUser() user: AuthUser, @Body(new ZodPipe(guardianLinkSchema)) body: z.infer<typeof guardianLinkSchema>) {
    return this.guardians.createLink(user, body);
  }

  @Roles('admin', 'coordinator')
  @Delete('admin/guardian-links/:id')
  unlink(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.guardians.revokeLink(user, id);
  }
}
