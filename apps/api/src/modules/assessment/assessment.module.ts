import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/public-api';
import { AssessmentController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { GradebookController } from './gradebook.controller';
import { GradebookService } from './gradebook.service';

@Module({
  imports: [LearningModule],
  controllers: [AssessmentController, GradebookController],
  providers: [AssessmentService, GradebookService],
  exports: [AssessmentService, GradebookService],
})
export class AssessmentModule {}
