import { IsString, IsOptional, IsEnum, IsNumber, IsUUID, IsDateString } from 'class-validator';

export class CreateMobDto {
  @IsString() name: string;
  @IsUUID() species_id: string;
  @IsOptional() @IsUUID() breed_id?: string;
  @IsOptional() @IsUUID() animal_class_id?: string;
  @IsNumber() head_count: number;
  @IsOptional() @IsDateString() dob_range_start?: string;
  @IsOptional() @IsDateString() dob_range_end?: string;
  @IsOptional() @IsString() source_farm?: string;
  @IsOptional() @IsDateString() purchase_date?: string;
  @IsOptional() @IsNumber() purchase_price_per_head?: number;
  @IsUUID() farm_id: string;
  @IsOptional() @IsUUID() created_by?: string;
}

export class UpdateMobStatusDto {
  @IsEnum(['active', 'sold', 'deceased', 'transferred']) status: string;
  @IsOptional() @IsNumber() head_count?: number;
}
