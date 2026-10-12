import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  alertNoteSchema,
  bulletinRequestSchema,
  guardianMessageSchema,
  meetingCloseSchema,
  meetingResponseSchema,
  meetingSchema,
  signatureDecisionSchema,
  staffMessageSchema,
} from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { CoordinationService } from './coordination.service';
import { FamilyService } from './family.service';
import { RectoriaService } from './rectoria.service';
import { StaffMessagesService } from './staff-messages.service';

const uuid = new ParseUUIDPipe();
const digestSchema = z.object({ enabled: z.boolean() });

@Controller()
export class GovernanceController {
  constructor(
    private readonly coordination: CoordinationService,
    private readonly rectoria: RectoriaService,
    private readonly family: FamilyService,
    private readonly staff: StaffMessagesService,
  ) {}

  /* ---------- Coordinación ---------- */

  @Roles('coordinator', 'admin')
  @Get('coordination/alerts')
  alerts(@Query('status') status?: string) {
    return this.coordination.alerts(status);
  }

  @Roles('coordinator', 'admin')
  @Get('coordination/alerts/:id')
  alert(@Param('id', uuid) id: string) {
    return this.coordination.alert(id);
  }

  @Roles('coordinator', 'admin')
  @Post('coordination/alerts/:id/notes')
  note(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(alertNoteSchema)) body: z.infer<typeof alertNoteSchema>) {
    return this.coordination.addNote(user, id, body);
  }

  @Roles('coordinator', 'admin')
  @Get('coordination/attendance')
  attendance(@Query('days') days?: string) {
    return this.coordination.attendance(Number(days) || 30);
  }

  @Roles('coordinator', 'admin')
  @Get('coordination/meetings')
  meetings(@Query('scope') scope?: string) {
    return this.coordination.meetings(scope);
  }

  @Roles('coordinator', 'admin')
  @Post('coordination/meetings')
  createMeeting(@CurrentUser() user: AuthUser, @Body(new ZodPipe(meetingSchema)) body: z.infer<typeof meetingSchema>) {
    return this.coordination.createMeeting(user, body);
  }

  @Roles('coordinator', 'admin')
  @Patch('coordination/meetings/:id')
  closeMeeting(@Param('id', uuid) id: string, @Body(new ZodPipe(meetingCloseSchema)) body: z.infer<typeof meetingCloseSchema>) {
    return this.coordination.closeMeeting(id, body);
  }

  @Roles('coordinator', 'admin')
  @Get('coordination/students')
  students(@Query('q') q?: string) {
    return this.coordination.searchStudents(q);
  }

  /* ---------- Rectoría ---------- */

  @Roles('rector', 'admin')
  @Get('rectoria/dashboard')
  dashboard(@Query('period') period?: string) {
    return this.rectoria.dashboard(period);
  }

  @Roles('rector', 'admin')
  @Get('rectoria/signatures')
  signatures() {
    return this.rectoria.signatures();
  }

  @Roles('rector')
  @Post('rectoria/signatures/certificates/:id')
  signCertificate(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(signatureDecisionSchema)) body: z.infer<typeof signatureDecisionSchema>) {
    return this.rectoria.decide(user, 'certificate', id, body);
  }

  @Roles('rector')
  @Post('rectoria/signatures/bulletins/:id')
  signBulletin(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(signatureDecisionSchema)) body: z.infer<typeof signatureDecisionSchema>) {
    return this.rectoria.decide(user, 'bulletin', id, body);
  }

  @Roles('teacher', 'coordinator', 'admin')
  @Post('bulletins/requests')
  requestBulletin(@CurrentUser() user: AuthUser, @Body(new ZodPipe(bulletinRequestSchema)) body: z.infer<typeof bulletinRequestSchema>) {
    return this.rectoria.requestBulletin(user, body.studentId);
  }

  @Roles('teacher', 'coordinator', 'rector', 'admin')
  @Get('bulletins/status')
  bulletinStatus(@Query('students') students?: string) {
    const ids = (students ?? '').split(',').filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
    return this.rectoria.bulletinStatus(ids);
  }

  /* ---------- Familia ---------- */

  @Roles('guardian')
  @Get('family/children')
  children(@CurrentUser() user: AuthUser) {
    return this.family.children(user);
  }

  @Roles('guardian')
  @Post('family/meetings/:id/respond')
  respond(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(meetingResponseSchema)) body: z.infer<typeof meetingResponseSchema>) {
    return this.family.respondMeeting(user, id, body);
  }

  @Roles('guardian')
  @Post('family/digest')
  digestNow(@CurrentUser() user: AuthUser) {
    return this.family.sendDigest(user.id);
  }

  @Roles('guardian')
  @Put('family/digest')
  digest(@CurrentUser() user: AuthUser, @Body(new ZodPipe(digestSchema)) body: z.infer<typeof digestSchema>) {
    return this.family.setDigest(user, body.enabled);
  }

  @Roles('guardian', 'teacher')
  @Get('messages/contacts')
  contacts(@CurrentUser() user: AuthUser) {
    return this.family.contacts(user);
  }

  @Roles('guardian', 'teacher')
  @Get('messages/threads')
  threads(@CurrentUser() user: AuthUser) {
    return this.family.threads(user);
  }

  @Roles('guardian', 'teacher')
  @Get('messages/unread')
  async unread(@CurrentUser() user: AuthUser) {
    return { unread: await this.family.unreadCount(user) };
  }

  @Roles('guardian', 'teacher')
  @Get('messages/:studentId/:counterpartId')
  messages(@CurrentUser() user: AuthUser, @Param('studentId', uuid) studentId: string, @Param('counterpartId', uuid) counterpartId: string) {
    return this.family.messages(user, studentId, counterpartId);
  }

  @Roles('guardian', 'teacher')
  @Post('messages')
  post(@CurrentUser() user: AuthUser, @Body(new ZodPipe(guardianMessageSchema)) body: z.infer<typeof guardianMessageSchema>) {
    return this.family.post(user, body);
  }

  /* ---------- Mensajes entre el personal ---------- */

  @Roles('teacher', 'coordinator', 'rector', 'admin')
  @Get('staff-messages/contacts')
  staffContacts(@CurrentUser() user: AuthUser) {
    return this.staff.contacts(user);
  }

  @Roles('teacher', 'coordinator', 'rector', 'admin')
  @Get('staff-messages/threads')
  staffThreads(@CurrentUser() user: AuthUser) {
    return this.staff.threads(user);
  }

  @Roles('teacher', 'coordinator', 'rector', 'admin')
  @Get('staff-messages/unread')
  async staffUnread(@CurrentUser() user: AuthUser) {
    return { unread: await this.staff.unreadCount(user) };
  }

  @Roles('teacher', 'coordinator', 'rector', 'admin')
  @Get('staff-messages/:userId')
  staffMessages(@CurrentUser() user: AuthUser, @Param('userId', uuid) userId: string) {
    return this.staff.messages(user, userId);
  }

  @Roles('teacher', 'coordinator', 'rector', 'admin')
  @Post('staff-messages')
  staffPost(@CurrentUser() user: AuthUser, @Body(new ZodPipe(staffMessageSchema)) body: z.infer<typeof staffMessageSchema>) {
    return this.staff.post(user, body);
  }
}
