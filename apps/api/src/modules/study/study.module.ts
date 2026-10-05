import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/public-api';
import { StudyController } from './study.controller';
import { StudyService } from './study.service';

@Module({
  imports: [LearningModule],
  controllers: [StudyController],
  providers: [StudyService],
  exports: [StudyService],
})
export class StudyModule {}
