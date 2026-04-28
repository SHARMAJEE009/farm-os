import { IsString, IsOptional, IsEnum, IsNumber, IsUUID, IsDateString } from 'class-validator';

export class CreateHealthEventDto {
  @IsEnum(['treatment', 'vaccination', 'mortality', 'condition_score']) event_type: string;
  @IsDateString() date: string;
  @IsOptional() @IsString() product_used?: string;
  @IsOptional() @IsString() dose?: string;
  @IsOptional() @IsNumber() withholding_period_days?: number;
  @IsOptional() @IsDateString() whp_expiry_date?: string;
  @IsOptional() @IsUUID() administered_by?: string;
  @IsNumber() head_count_affected: number;
  @IsOptional() @IsString() cause?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumber() cost_amount?: number;
}
