import { Module } from '@nestjs/common';
import { Cloudinary } from './cloudinary';
import { LibraryController } from './library.controller';
import { LibraryService } from './library.service';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, Cloudinary],
  exports: [LibraryService],
})
export class LibraryModule {}
