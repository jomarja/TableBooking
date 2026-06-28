import { Module } from '@nestjs/common';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';
import { CustomerMetaService } from './customer-meta.service';

@Module({
  controllers: [ReservationsController],
  providers: [ReservationsService, CustomerMetaService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
