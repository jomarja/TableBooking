import { Module } from '@nestjs/common';
import { ImportModule } from '../import/import.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [ImportModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
