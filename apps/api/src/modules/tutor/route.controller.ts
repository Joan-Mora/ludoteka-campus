import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { routeAnswerSchema, routeGenerateSchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { RouteService } from './route.service';

@Controller()
export class RouteController {
  constructor(private readonly route: RouteService) {}

  @Roles('student')
  @Get('route')
  overview(@CurrentUser() user: AuthUser) {
    return this.route.overview(user);
  }

  @Roles('student')
  @Post('route/generate')
  generate(@CurrentUser() user: AuthUser, @Body(new ZodPipe(routeGenerateSchema)) body: { topicId?: string; count?: number }) {
    return this.route.generate(user, body);
  }

  @Roles('student')
  @Post('route/items/:id/answer')
  answer(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(routeAnswerSchema)) body: { answer: string }) {
    return this.route.answer(user, id, body.answer);
  }

  @Roles('student')
  @Post('route/items/:id/skip')
  skip(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.route.skip(user, id);
  }

  @Roles('teacher', 'admin', 'coordinator', 'rector')
  @Get('courses/:id/mastery')
  mastery(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.route.courseMastery(user, id);
  }
}
