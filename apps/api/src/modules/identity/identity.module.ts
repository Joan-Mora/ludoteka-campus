import { Module } from '@nestjs/common';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';

@Module({
  controllers: [IdentityController, GuardiansController],
  providers: [IdentityService, GuardiansService],
  exports: [IdentityService, GuardiansService],
})
export class IdentityModule {}
