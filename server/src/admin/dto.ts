import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateRestaurantDto {
  @IsString() name!: string;
  @IsOptional() @IsString() cuisine?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() phone?: string;
  @IsEmail() ownerEmail!: string;
  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsString() ownerPassword?: string;
}

export class SetStatusDto {
  @IsIn(['PENDING', 'APPROVED', 'DISABLED'])
  status!: 'PENDING' | 'APPROVED' | 'DISABLED';
}

export class ResetPasswordDto {
  @IsString() password!: string;
}
