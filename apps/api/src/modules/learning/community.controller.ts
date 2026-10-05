import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { forumPostSchema, forumThreadSchema, newsSchema } from '@eduquest/contracts';
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

  @Roles('teacher', 'admin', 'directivo')
  @Get('news/targets')
  targets(@CurrentUser() user: AuthUser) {
    return this.news.targets(user);
  }

  @Roles('teacher', 'admin', 'directivo')
  @Post('news')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(newsSchema)) body: z.infer<typeof newsSchema>) {
    return this.news.create(user, body);
  }

  @Roles('teacher', 'admin', 'directivo')
  @Patch('news/:id/pin')
  pin(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(pinSchema)) body: { pinned: boolean }) {
    return this.news.pin(user, id, body.pinned);
  }

  @Roles('teacher', 'admin', 'directivo')
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

  @Roles('teacher', 'admin', 'directivo')
  @Get('news/:id/receipts')
  receipts(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.news.receipts(user, id);
  }

  @Roles('teacher', 'admin', 'directivo', 'student')
  @Get('courses/:id/forum')
  threads(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.threads(user, id);
  }

  @Roles('teacher', 'admin', 'directivo', 'student')
  @Post('courses/:id/forum')
  createThread(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(forumThreadSchema)) body: { title: string; body: string }) {
    return this.forums.createThread(user, id, body);
  }

  @Roles('teacher', 'admin', 'directivo', 'student')
  @Get('forum/threads/:id')
  thread(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.thread(user, id);
  }

  @Roles('teacher', 'admin', 'directivo', 'student')
  @Post('forum/threads/:id/posts')
  reply(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(forumPostSchema)) body: { body: string }) {
    return this.forums.reply(user, id, body.body);
  }

  @Roles('teacher', 'admin', 'directivo')
  @Patch('forum/threads/:id')
  moderate(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(moderateSchema)) body: { pinned?: boolean; locked?: boolean }) {
    return this.forums.moderate(user, id, body);
  }

  @Roles('teacher', 'admin', 'directivo', 'student')
  @Post('forum/posts/:id/answer')
  answer(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.markAnswer(user, id);
  }

  @Roles('teacher', 'admin', 'directivo', 'student')
  @Delete('forum/posts/:id')
  removePost(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.forums.removePost(user, id);
  }
}
