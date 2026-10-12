import { Module } from '@nestjs/common';
import { LearningProfileModule } from '../profile/public-api';
import { CoordinationService } from './coordination.service';
import { FamilyService } from './family.service';
import { GovernanceController } from './governance.controller';
import { RectoriaService } from './rectoria.service';
import { StaffMessagesService } from './staff-messages.service';

@Module({
  imports: [LearningProfileModule],
  controllers: [GovernanceController],
  providers: [CoordinationService, RectoriaService, FamilyService, StaffMessagesService],
  exports: [FamilyService],
})
export class GovernanceModule {}
