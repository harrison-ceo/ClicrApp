import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { SyncModule } from './sync/sync.module';
import { LogErrorModule } from './log-error/log-error.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    OnboardingModule,
    SyncModule,
    LogErrorModule,
    ReportsModule,
  ],
})
export class AppModule {}
