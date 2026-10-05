import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/public-api';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';

@Module({
  imports: [LearningModule],
  controllers: [ArenaController],
  providers: [ArenaService],
  exports: [ArenaService],
})
export class ArenaModule {}
