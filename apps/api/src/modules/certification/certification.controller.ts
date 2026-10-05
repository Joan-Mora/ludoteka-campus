import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { certificateIssueSchema } from '@eduquest/contracts';
import { CurrentUser, Public, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { CertificationService } from './certification.service';

@Controller()
export class CertificationController {
  constructor(private readonly certificates: CertificationService) {}

  @Roles('teacher', 'admin')
  @Post('certificates')
  issue(@CurrentUser() user: AuthUser, @Body(new ZodPipe(certificateIssueSchema)) body: { userId: string; courseId: string }) {
    return this.certificates.issue(user.id, body);
  }

  @Get('certificates/mine')
  mine(@CurrentUser() user: AuthUser) {
    return this.certificates.mine(user.id);
  }

  @Public()
  @Get('public/certificates/:code')
  verify(@Param('code') code: string) {
    return this.certificates.publicByCode(code);
  }

  @Public()
  @Get('public/certificates/:code/pdf')
  async pdf(@Param('code') code: string, @Res() res: Response) {
    const file = await this.certificates.pdf(code);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${code}.pdf"`);
    res.send(file);
  }
}
