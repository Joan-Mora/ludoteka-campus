import { Global, Injectable, Module } from '@nestjs/common';
import { AppEnv, loadEnv } from './env';

@Injectable()
export class Env {
  readonly values: AppEnv = loadEnv();
}

@Global()
@Module({
  providers: [Env],
  exports: [Env],
})
export class ConfigModule {}
