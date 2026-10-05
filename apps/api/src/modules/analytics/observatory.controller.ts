import { Body, Controller, Get, Post } from '@nestjs/common';
import { nlQuerySchema } from '@eduquest/contracts';
import { CurrentUser, Roles, type AuthUser } from '../../core/auth/auth.decorators';
import { ZodPipe } from '../../core/common/zod.pipe';
import { ObservatoryService } from './observatory.service';

@Controller('observatory')
@Roles('teacher', 'admin', 'directivo')
export class ObservatoryController {
  constructor(private readonly observatory: ObservatoryService) {}

  @Get('schema')
  schema() {
    return this.observatory.schema();
  }

  @Get('history')
  history(@CurrentUser() user: AuthUser) {
    return this.observatory.history(user);
  }

  @Post('ask')
  ask(@CurrentUser() user: AuthUser, @Body(new ZodPipe(nlQuerySchema)) body: { question: string }) {
    return this.observatory.ask(user, body.question);
  }
}
