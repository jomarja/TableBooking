import {
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCustomerReservationDto {
  @IsString() @MaxLength(64) restaurantId!: string;
  @IsOptional() @IsString() @MaxLength(64) tableId?: string;
  @IsString() @MaxLength(10) date!: string;
  @IsString() @MaxLength(5) startTime!: string;
  @IsOptional() @IsString() @MaxLength(5) endTime?: string;
  @IsInt() @Min(1) guests!: number;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) surname?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(100) occasion?: string;
  @IsOptional() @IsString() @MaxLength(2000) customerNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) specialRequest?: string;
}

export class CreateStaffReservationDto {
  @IsOptional() @IsString() @MaxLength(64) tableId?: string;
  @IsString() @MaxLength(10) date!: string;
  @IsString() @MaxLength(5) startTime!: string;
  @IsOptional() @IsString() @MaxLength(5) endTime?: string;
  @IsOptional() @IsInt() @Min(1) guests?: number;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) surname?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) occasion?: string;
  @IsOptional() @IsString() @MaxLength(2000) customerNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) staffNotes?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsString() @MaxLength(20) channel?: string;
}

export class UpdateReservationDto {
  @IsOptional() @IsString() @MaxLength(64) tableId?: string;
  @IsOptional() @IsString() @MaxLength(10) date?: string;
  @IsOptional() @IsString() @MaxLength(5) startTime?: string;
  @IsOptional() @IsString() @MaxLength(5) endTime?: string;
  @IsOptional() @IsInt() guests?: number;
  @IsOptional() @IsString() @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MaxLength(100) surname?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(100) occasion?: string;
  @IsOptional() @IsString() @MaxLength(2000) customerNotes?: string;
  @IsOptional() @IsString() @MaxLength(2000) staffNotes?: string;
  @IsOptional() @IsString() @MaxLength(20) status?: string;
  @IsOptional() @IsString() @MaxLength(20) channel?: string;
}
