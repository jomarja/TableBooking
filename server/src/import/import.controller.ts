import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards';
import { ImportService } from './import.service';

class ImportDto {
  @IsString() url!: string;
  @IsOptional() @IsString() provider?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('import')
export class ImportController {
  constructor(private importer: ImportService) {}

  @Post()
  prefill(@Body() dto: ImportDto) {
    return this.importer.prefill(dto.url, dto.provider);
  }
}
