import { Global, Module } from '@nestjs/common';
import { RecurrenceService } from './recurrence.service';

@Global()
@Module({
  providers: [RecurrenceService],
  exports: [RecurrenceService],
})
export class RecurrenceModule {}
