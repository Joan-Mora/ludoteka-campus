import { Module } from '@nestjs/common';
import { LearningProfileController } from './profile.controller';
import { LearningProfileService } from './profile.service';

@Module({
  controllers: [LearningProfileController],
  providers: [LearningProfileService],
  exports: [LearningProfileService],
})
export class LearningProfileModule {}
