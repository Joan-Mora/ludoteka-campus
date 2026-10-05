import { Module } from '@nestjs/common';
import { IntegrityModule } from '../integrity/public-api';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [IntegrityModule],
  controllers: [TutorController],
  providers: [TutorService],
  exports: [TutorService],
})
export class TutorModule {}
