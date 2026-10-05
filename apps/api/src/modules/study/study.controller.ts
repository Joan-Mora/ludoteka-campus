import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { flashcardReviewSchema, flashcardSchema, focusStartSchema, goalSchema, notebookPageSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { StudyService } from './study.service';

type PageInput = { title: string; body: string; courseId?: string | null };

@Roles('student')
@Controller('study')
export class StudyController {
  constructor(private readonly study: StudyService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.study.overview(user);
  }

  @Get('pages/:id')
  page(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.page(user, id);
  }

  @Post('pages')
  createPage(@CurrentUser() user: AuthUser, @Body(new ZodPipe(notebookPageSchema)) body: PageInput) {
    return this.study.createPage(user, body);
  }

  @Put('pages/:id')
  updatePage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(notebookPageSchema)) body: PageInput) {
    return this.study.updatePage(user, id, body);
  }

  @Delete('pages/:id')
  deletePage(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.deletePage(user, id);
  }

  @Post('pages/:id/summary')
  summarize(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.summarize(user, id);
  }

  @Post('pages/:id/cards')
  cardsFromSummary(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.cardsFromSummary(user, id);
  }

  @Get('cards')
  cards(@CurrentUser() user: AuthUser, @Query('scope') scope?: string) {
    return this.study.cards(user, scope === 'all' ? 'all' : 'due');
  }

  @Post('cards')
  createCard(@CurrentUser() user: AuthUser, @Body(new ZodPipe(flashcardSchema)) body: { front: string; back: string; pageId?: string }) {
    return this.study.createCard(user, body);
  }

  @Delete('cards/:id')
  deleteCard(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.deleteCard(user, id);
  }

  @Post('cards/:id/review')
  review(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(flashcardReviewSchema)) body: { grade: number }) {
    return this.study.review(user, id, body.grade);
  }

  @Post('goals')
  setGoal(@CurrentUser() user: AuthUser, @Body(new ZodPipe(goalSchema)) body: { kind: string; period: string; target: number }) {
    return this.study.setGoal(user, body);
  }

  @Delete('goals/:id')
  removeGoal(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.removeGoal(user, id);
  }

  @Post('focus')
  startFocus(@CurrentUser() user: AuthUser, @Body(new ZodPipe(focusStartSchema)) body: { plannedMin: number; pageId?: string }) {
    return this.study.startFocus(user, body);
  }

  @Post('focus/:id/finish')
  finishFocus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.finishFocus(user, id);
  }

  @Post('focus/:id/cancel')
  cancelFocus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.study.finishFocus(user, id, true);
  }
}
