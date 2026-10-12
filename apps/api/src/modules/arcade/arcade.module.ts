import { Module } from '@nestjs/common';
import { IntegrityModule } from '../integrity/public-api';
import { ArcadeController } from './arcade.controller';
import { ArcadeService } from './arcade.service';

@Module({
  imports: [IntegrityModule],
  controllers: [ArcadeController],
  providers: [ArcadeService],
})
export class ArcadeModule {}
