import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { ImportModule } from '../import/import.module';
import { RestaurantsController } from './restaurants.controller';
import { RestaurantsService } from './restaurants.service';

@Module({
  imports: [AvailabilityModule, ImportModule],
  controllers: [RestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
