import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/public-api';
import { IntegrityModule } from '../integrity/public-api';
import { LibraryModule } from '../library/public-api';
import { RouteController } from './route.controller';
import { RouteService } from './route.service';
import { TutorController } from './tutor.controller';
import { TutorService } from './tutor.service';

@Module({
  imports: [IntegrityModule, IdentityModule, LibraryModule],
  controllers: [TutorController, RouteController],
  providers: [TutorService, RouteService],
  exports: [TutorService, RouteService],
})
export class TutorModule {}
