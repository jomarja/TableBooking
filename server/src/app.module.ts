import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import type { ServerResponse } from 'http';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { RecurrenceModule } from './recurrence/recurrence.module';
import { AuthModule } from './auth/auth.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { ReservationsModule } from './reservations/reservations.module';
import { BlockedModule } from './blocked/blocked.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadModule } from './upload/upload.module';
import { UPLOAD_DIR } from './config/env';

@Module({
  imports: [
    // Global default rate limit (per IP). Sensitive routes (login, public
    // booking, upload) tighten this further with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ServeStaticModule.forRoot({
      rootPath: UPLOAD_DIR,
      serveRoot: '/uploads',
      serveStaticOptions: {
        index: false,
        // Defense-in-depth for user-uploaded files: never let the browser sniff
        // a file into an executable type, and forbid any active content via CSP.
        setHeaders: (res: ServerResponse) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
          );
        },
      },
    }),
    PrismaModule,
    AuditModule,
    RecurrenceModule,
    AuthModule,
    RestaurantsModule,
    ReservationsModule,
    BlockedModule,
    AdminModule,
    DashboardModule,
    UploadModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
