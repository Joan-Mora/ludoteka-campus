import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { z } from 'zod';
import { bookmarkSchema, glossarySchema, libraryAskSchema, libraryItemSchema, libraryUpdateSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { LibraryService } from './library.service';

const uuid = new ParseUUIDPipe();

@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get('catalog')
  catalog() {
    return this.library.catalog();
  }

  @Get('items')
  list(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('subjectId') subjectId?: string,
    @Query('gradeId') gradeId?: string,
    @Query('kind') kind?: string,
    @Query('tag') tag?: string,
    @Query('saved') saved?: string,
  ) {
    const uuid = (value?: string) => (value && /^[0-9a-f-]{36}$/i.test(value) ? value : undefined);
    return this.library.list(user, { q, subjectId: uuid(subjectId), gradeId: uuid(gradeId), kind, tag, saved: saved === '1' || saved === 'true' });
  }

  @Get('items/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.library.get(user, id);
  }

  @Roles('teacher', 'admin')
  @Post('uploads/ticket')
  ticket() {
    return this.library.uploadTicket();
  }

  @Roles('teacher', 'admin')
  @Post('items')
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(libraryItemSchema)) body: z.infer<typeof libraryItemSchema>) {
    return this.library.create(user, body);
  }

  @Roles('teacher', 'admin')
  @Patch('items/:id')
  update(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(libraryUpdateSchema)) body: z.infer<typeof libraryUpdateSchema>) {
    return this.library.update(user, id, body);
  }

  @Roles('teacher', 'admin')
  @Post('items/:id/reindex')
  reindex(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.library.reindex(user, id);
  }

  @Roles('teacher', 'admin')
  @Delete('items/:id')
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.library.remove(user, id);
  }

  @Post('items/:id/bookmark')
  bookmark(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string, @Body(new ZodPipe(bookmarkSchema)) body: z.infer<typeof bookmarkSchema>) {
    return this.library.bookmark(user, id, body);
  }

  @Delete('items/:id/bookmark')
  unbookmark(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.library.unbookmark(user, id);
  }

  @Get('glossary')
  glossary(@Query('subjectId') subjectId?: string, @Query('q') q?: string) {
    return this.library.glossary({ subjectId, q });
  }

  @Roles('teacher', 'admin')
  @Post('glossary')
  addTerm(@CurrentUser() user: AuthUser, @Body(new ZodPipe(glossarySchema)) body: z.infer<typeof glossarySchema>) {
    return this.library.addTerm(user, body);
  }

  @Roles('teacher', 'admin')
  @Delete('glossary/:id')
  removeTerm(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.library.removeTerm(user, id);
  }

  @Post('ask')
  ask(@CurrentUser() user: AuthUser, @Body(new ZodPipe(libraryAskSchema)) body: z.infer<typeof libraryAskSchema>) {
    return this.library.ask(user, body);
  }
}
