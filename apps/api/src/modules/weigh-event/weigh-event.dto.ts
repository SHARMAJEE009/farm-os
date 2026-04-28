import { IsDateString, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateWeighEventDto {
  @IsDateString() date: string;
  @IsNumber() head_count_weighed: number;
  @IsNumber() average_weight_kg: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsUUID() recorded_by?: string;
}
