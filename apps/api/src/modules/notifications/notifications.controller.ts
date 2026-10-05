import { Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../core/auth/auth.decorators';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user.id);
  }

  @Post(':id/read')
  read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.read(user.id, id);
  }
}
