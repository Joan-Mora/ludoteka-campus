import { Module } from '@nestjs/common';
import { CoordinationService } from './coordination.service';
import { FamilyService } from './family.service';
import { GovernanceController } from './governance.controller';
import { RectoriaService } from './rectoria.service';

@Module({
  controllers: [GovernanceController],
  providers: [CoordinationService, RectoriaService, FamilyService],
  exports: [FamilyService],
})
export class GovernanceModule {}
