import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateRestaurantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() cuisine?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() openingTime?: string;
  @IsOptional() @IsString() kitchenClosing?: string;
  @IsOptional() @IsString() closingTime?: string;
  @IsOptional() @IsString() priceRange?: string;
  @IsOptional() @IsInt() priceLevel?: number;
  @IsOptional() @IsBoolean() allowTableSelection?: boolean;
  @IsOptional() @IsInt() maxGuests?: number;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() outdoorSeating?: boolean;
  @IsOptional() @IsBoolean() familyFriendly?: boolean;
  @IsOptional() @IsString() importSource?: string;
  @IsOptional() @IsString() floorPlanBackground?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) restDays?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) cuisines?: string[];
  @IsOptional() @IsNumber() lat?: number;
  @IsOptional() @IsNumber() lng?: number;
  @IsOptional() openingHours?: any;
  @IsOptional() reservationRules?: any;
  @IsOptional() reservationConfirmationPolicy?: any;
  @IsOptional() capacityRules?: any;
  @IsOptional() @IsArray() holidayClosures?: any[];
}

export class SetZonesDto {
  @IsArray() zones!: { id?: string; name: string }[];
}

export class SetTablesDto {
  @IsArray() tables!: any[];
}

export class SetFloorPlanDto {
  @IsArray() elements!: any[];
  @IsOptional() @IsString() background?: string | null;
}
