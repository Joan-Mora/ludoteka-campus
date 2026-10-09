import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { z } from 'zod';
import { createUserSchema, importCommitSchema, updateUserSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { XLSX_TYPE } from '../../core/reports/documents';
import { AccountsService } from './accounts.service';

/** Upload routes receive the raw file; main.ts mounts the raw body parser on them. */
export const RAW_UPLOAD_ROUTES = ['/api/admin/users/import/preview', '/api/admin/structure/import'];

function sendXlsx(res: Response, file: Buffer, name: string) {
  res.setHeader('Content-Type', XLSX_TYPE);
  res.setHeader('Content-Disposition', `attachment; filename="${name}.xlsx"`);
  res.send(file);
}

const uploaded = (req: Request) => (Buffer.isBuffer(req.body) && req.body.length ? (req.body as Buffer) : undefined);

@Roles('admin')
@Controller('admin')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('users')
  list(@Query('q') q?: string, @Query('role') role?: string, @Query('groupId') groupId?: string, @Query('status') status?: string) {
    return this.accounts.list({ q, role, groupId, status });
  }

  @Post('users')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createUserSchema)) body: z.infer<typeof createUserSchema>) {
    return this.accounts.create(user, body);
  }

  @Get('users/template.xlsx')
  async template(@Res() res: Response) {
    sendXlsx(res, await this.accounts.usersTemplate(), 'plantilla-usuarios-ludoteka');
  }

  @HttpCode(200)
  @Post('users/import/preview')
  preview(@Req() req: Request, @Query('name') name = 'archivo.xlsx') {
    return this.accounts.previewUsers(uploaded(req) ?? Buffer.alloc(0), name);
  }

  @Post('users/import/commit')
  commit(@CurrentUser() user: AuthUser, @Body(new ZodPipe(importCommitSchema)) body: z.infer<typeof importCommitSchema>) {
    return this.accounts.commitUsers(user, body);
  }

  @Get('imports')
  imports() {
    return this.accounts.imports();
  }

  @Get('users/:id/activity')
  activity(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.accounts.activity(id);
  }

  @Patch('users/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Body(new ZodPipe(updateUserSchema)) body: z.infer<typeof updateUserSchema>) {
    return this.accounts.update(user, id, body);
  }

  @HttpCode(200)
  @Post('users/:id/resend-access')
  resend(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.accounts.resendAccess(user, id);
  }

  @HttpCode(200)
  @Post('users/:id/force-password')
  forcePassword(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.accounts.forcePasswordChange(user, id);
  }

  @HttpCode(200)
  @Post('users/:id/revoke-sessions')
  revokeSessions(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.accounts.revokeSessions(user, id);
  }

  @Get('structure/template.xlsx')
  async structureTemplate(@Res() res: Response) {
    sendXlsx(res, await this.accounts.structureTemplate(), 'plantilla-estructura-ludoteka');
  }

  @HttpCode(200)
  @Post('structure/import')
  importStructure(@CurrentUser() user: AuthUser, @Req() req: Request, @Query('name') name = 'estructura.xlsx', @Query('dryRun') dryRun?: string) {
    return this.accounts.importStructure(user, uploaded(req), name, dryRun === '1' || dryRun === 'true');
  }
}
