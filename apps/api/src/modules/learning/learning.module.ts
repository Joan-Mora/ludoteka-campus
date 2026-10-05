import { Module } from '@nestjs/common';
import { CommunityController } from './community.controller';
import { ForumsService } from './forums.service';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
import { NewsService } from './news.service';

@Module({
  controllers: [LearningController, CommunityController],
  providers: [LearningService, NewsService, ForumsService],
  exports: [LearningService, NewsService],
})
export class LearningModule {}
