import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, Env } from './core/config/config.module';
import { DatabaseModule } from './core/database/database.module';
import { MailModule } from './core/mail/mail.module';
import { AiModule } from './core/ai/ai.module';
import { RealtimeModule } from './core/realtime/realtime.module';
import { HttpExceptionFilter } from './core/errors/http-exception.filter';
import { JwtAuthGuard, RolesGuard } from './core/auth/guards';
import { HealthModule } from './modules/health/health.module';
import { IdentityModule } from './modules/identity/identity.module';
import { InstitutionModule } from './modules/institution/institution.module';
import { LearningModule } from './modules/learning/learning.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { IntegrityModule } from './modules/integrity/integrity.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { TutorModule } from './modules/tutor/tutor.module';
import { BiometricsModule } from './modules/biometrics/biometrics.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CertificationModule } from './modules/certification/certification.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    MailModule,
    AiModule,
    EventEmitterModule.forRoot(),
    JwtModule.registerAsync({
      global: true,
      inject: [Env],
      useFactory: (env: Env) => ({
        secret: env.values.JWT_SECRET,
        signOptions: { expiresIn: '20m' },
      }),
    }),
    RealtimeModule,
    HealthModule,
    IdentityModule,
    InstitutionModule,
    LearningModule,
    AssessmentModule,
    IntegrityModule,
    GamificationModule,
    TutorModule,
    BiometricsModule,
    AnalyticsModule,
    CertificationModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
