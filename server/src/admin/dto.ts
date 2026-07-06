import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRestaurantDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @MaxLength(80) cuisine?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsString() @MaxLength(300) website?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(5) rating?: number;
  @IsOptional() @IsString() @MaxLength(40) priceRange?: string;
  @IsEmail() ownerEmail!: string;
  @IsOptional() @IsString() @MaxLength(120) ownerName?: string;
  // Required, non-trivial: the API never invents a default password.
  @IsString() @MinLength(8) @MaxLength(128) ownerPassword!: string;
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
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}

export class SetStatusDto {
  @IsIn(['PENDING', 'APPROVED', 'DISABLED'])
  status!: 'PENDING' | 'APPROVED' | 'DISABLED';
}

export class ResetPasswordDto {
  @IsString() @MinLength(8) @MaxLength(128) password!: string;
}
