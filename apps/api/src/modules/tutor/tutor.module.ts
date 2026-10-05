import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/public-api';
import { IntegrityModule } from '../integrity/public-api';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [IntegrityModule, IdentityModule],
  controllers: [TutorController],
  providers: [TutorService],
  exports: [TutorService],
})
export class TutorModule {}
