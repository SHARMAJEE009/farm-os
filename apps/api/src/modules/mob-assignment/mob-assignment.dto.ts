import { IsUUID, IsDateString, IsNumber, IsOptional, IsEnum, IsString } from 'class-validator';

export class AssignPaddockDto {
  @IsUUID() paddock_id: string;
  @IsDateString() entry_date: string;
  @IsNumber() entry_head_count: number;
}

export class ExitPaddockDto {
  @IsDateString() exit_date: string;
  @IsNumber() exit_head_count: number;
  @IsEnum(['sold', 'moved', 'deceased', 'other']) exit_reason: string;
  @IsOptional() @IsNumber() sale_price_per_head?: number;
}

export class MoveMobDto {
  @IsUUID() destination_paddock_id: string;
  @IsDateString() move_date: string;
  @IsNumber() head_count: number;
  @IsOptional() @IsString() notes?: string;
}
