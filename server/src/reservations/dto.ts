import {
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCustomerReservationDto {
  @IsString() restaurantId!: string;
  @IsOptional() @IsString() tableId?: string;
  @IsString() date!: string;
  @IsString() startTime!: string;
  @IsOptional() @IsString() endTime?: string;
  @IsInt() @Min(1) guests!: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() surname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() occasion?: string;
  @IsOptional() @IsString() customerNotes?: string;
  @IsOptional() @IsString() specialRequest?: string;
}

export class CreateStaffReservationDto {
  @IsOptional() @IsString() tableId?: string;
  @IsString() date!: string;
  @IsString() startTime!: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsInt() @Min(1) guests?: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() surname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() occasion?: string;
  @IsOptional() @IsString() customerNotes?: string;
  @IsOptional() @IsString() staffNotes?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() channel?: string;
}

export class UpdateReservationDto {
  @IsOptional() @IsString() tableId?: string;
  @IsOptional() @IsString() date?: string;
  @IsOptional() @IsString() startTime?: string;
  @IsOptional() @IsString() endTime?: string;
  @IsOptional() @IsInt() guests?: number;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() surname?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() occasion?: string;
  @IsOptional() @IsString() customerNotes?: string;
  @IsOptional() @IsString() staffNotes?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() channel?: string;
}
