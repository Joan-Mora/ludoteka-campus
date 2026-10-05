import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/public-api';
import { BiometricsController } from './biometrics.controller';
import { BiometricsService } from './biometrics.service';

@Module({
  imports: [IdentityModule],
  controllers: [BiometricsController],
  providers: [BiometricsService],
  exports: [BiometricsService],
})
export class BiometricsModule {}
