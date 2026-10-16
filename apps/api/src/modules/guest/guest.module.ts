import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/public-api';
import { GuestController } from './guest.controller';
import { GuestService } from './guest.service';

@Module({
  imports: [IdentityModule],
  controllers: [GuestController],
  providers: [GuestService],
})
export class GuestModule {}
