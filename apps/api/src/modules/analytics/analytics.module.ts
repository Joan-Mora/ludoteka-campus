import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { ObservatoryController } from './observatory.controller';
import { ObservatoryService } from './observatory.service';

@Module({
  controllers: [AnalyticsController, ObservatoryController],
  providers: [AnalyticsService, ObservatoryService],
})
export class AnalyticsModule {}
