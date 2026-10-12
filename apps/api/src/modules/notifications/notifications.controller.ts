import { Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../core/auth/auth.decorators';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query('estado') estado?: string, @Query('tipo') tipo?: string, @Query('limite') limite?: string) {
    return this.notifications.list(user.id, { unread: estado === 'sin-leer', kind: tipo, limit: limite ? Number(limite) || undefined : undefined });
  }

  @Post('read-all')
  readAll(@CurrentUser() user: AuthUser, @Query('tipo') tipo?: string) {
    return this.notifications.readAll(user.id, tipo);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.notifications.read(user.id, id);
  }
}
