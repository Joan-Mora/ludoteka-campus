import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { forumPostSchema, forumReactionSchema, forumThreadSchema, newsSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { ForumsService } from './forums.service';
import { NewsService } from './news.service';

const pinSchema = z.object({ pinned: z.boolean() });
const moderateSchema = z.object({ pinned: z.boolean().optional(), locked: z.boolean().optional() });
const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class CommunityController {
  constructor(
    private readonly news: NewsService,
    private readonly forums: ForumsService,
  ) {}

  @Get('news')
  feed(@CurrentUser() user: AuthUser, @Query('limit') limit?: string) {
    return this.news.feed(user, Number(limit) || 40);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Get('news/targets')
  targets(@CurrentUser() user: AuthUser) {
    return this.news.targets(user);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Post('news')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(newsSchema)) body: z.infer<typeof newsSchema>) {
    return this.news.create(user, body);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Patch('news/:id/pin')
  pin(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(pinSchema)) body: { pinned: boolean }) {
    return this.news.pin(user, id, body.pinned);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Delete('news/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.news.remove(user, id);
  }

  @Post('news/:id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.news.markRead(user, id, false);
  }

  @Post('news/:id/ack')
  ack(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.news.markRead(user, id, true);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Get('news/:id/receipts')
  receipts(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.news.receipts(user, id);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector', 'student')
  @Get('courses/:id/forum')
  threads(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.threads(user, id);
  }

  @Roles('teacher', 'admin', 'student')
  @Post('courses/:id/forum')
  createThread(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(forumThreadSchema)) body: z.infer<typeof forumThreadSchema>) {
    return this.forums.createThread(user, id, body);
  }

  @Roles('teacher', 'admin', 'student')
  @Get('courses/:id/forum/members')
  members(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.members(user, id);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector', 'student')
  @Get('forum/threads/:id')
  thread(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.thread(user, id);
  }

  @Roles('teacher', 'admin', 'student')
  @Post('forum/threads/:id/posts')
  reply(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(forumPostSchema)) body: z.infer<typeof forumPostSchema>) {
    return this.forums.reply(user, id, body);
  }

  @Roles('teacher', 'admin', 'coordinator')
  @Post('forum/threads/:id/summary')
  summarize(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Query('force') force?: string) {
    return this.forums.summarize(user, id, force === '1');
  }

  @Roles('teacher', 'admin', 'student')
  @Post('forum/posts/:id/reactions')
  react(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(forumReactionSchema)) body: z.infer<typeof forumReactionSchema>) {
    return this.forums.react(user, id, body.kind);
  }

  @Roles('teacher', 'admin', 'coordinator')
  @Patch('forum/threads/:id')
  moderate(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(moderateSchema)) body: { pinned?: boolean; locked?: boolean }) {
    return this.forums.moderate(user, id, body);
  }

  @Roles('teacher', 'admin', 'coordinator')
  @Delete('forum/threads/:id')
  removeThread(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.removeThread(user, id);
  }

  @Roles('teacher', 'admin', 'student')
  @Post('forum/posts/:id/answer')
  answer(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.markAnswer(user, id);
  }

  @Roles('teacher', 'admin', 'coordinator', 'student')
  @Delete('forum/posts/:id')
  removePost(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.removePost(user, id);
  }
}
