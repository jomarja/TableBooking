import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { RecurrenceModule } from './recurrence/recurrence.module';
import { AuthModule } from './auth/auth.module';
import { RestaurantsModule } from './restaurants/restaurants.module';
import { ReservationsModule } from './reservations/reservations.module';
import { BlockedModule } from './blocked/blocked.module';
import { ImportModule } from './import/import.module';
import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: { index: false },
    }),
    PrismaModule,
    RecurrenceModule,
    AuthModule,
    RestaurantsModule,
    ReservationsModule,
    BlockedModule,
    ImportModule,
    AdminModule,
    DashboardModule,
    UploadModule,
  ],
})
export class AppModule {}
