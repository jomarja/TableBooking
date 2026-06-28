import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString() name!: string;
  @IsOptional() @IsString() cuisine?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsOptional() @IsString() priceRange?: string;
  @IsEmail() ownerEmail!: string;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsString() ownerPassword?: string;
}

/** Admin can edit any of these core restaurant fields after creation. */
export class AdminUpdateRestaurantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() cuisine?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsOptional() @IsInt() @Min(0) reviewCount?: number;
  @IsOptional() @IsString() priceRange?: string;
  @IsOptional() @IsInt() @Min(1) @Max(4) priceLevel?: number;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() outdoorSeating?: boolean;
  @IsOptional() @IsBoolean() familyFriendly?: boolean;
  @IsOptional() @IsString() description?: string;
}

export class SetStatusDto {
  @IsIn(['PENDING', 'APPROVED', 'DISABLED'])
  status!: 'PENDING' | 'APPROVED' | 'DISABLED';
}

export class ResetPasswordDto {
  @IsString() password!: string;
}
