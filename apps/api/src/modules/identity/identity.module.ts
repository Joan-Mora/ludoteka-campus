import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { PasskeysController } from './passkeys.controller';
import { PasskeysService } from './passkeys.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  controllers: [IdentityController, GuardiansController, AccountsController, PasskeysController, SettingsController],
  providers: [IdentityService, GuardiansService, AccountsService, PasskeysService, SettingsService],
  exports: [IdentityService, GuardiansService],
})
export class IdentityModule {}
