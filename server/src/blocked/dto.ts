import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateBlockedDto {
  @IsOptional() @IsString() scope?: string; // TABLES | ZONE
  @IsOptional() @IsArray() tableIds?: string[];
  @IsOptional() @IsString() zoneId?: string;
  @IsOptional() @IsString() type?: string; // SINGLE | RECURRING
  @IsOptional() @IsString() date?: string;
  @IsOptional() recurrenceRule?: any;
  @IsString() startTime!: string;
  @IsString() endTime!: string;
  @IsOptional() @IsString() reason?: string;
}

export class UpdateBlockedDto {
  @IsOptional() @IsString() scope?: string;
  @IsOptional() @IsArray() tableIds?: string[];
  @IsOptional() @IsString() zoneId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() recurrenceRule?: any;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsString() reason?: string;
}
