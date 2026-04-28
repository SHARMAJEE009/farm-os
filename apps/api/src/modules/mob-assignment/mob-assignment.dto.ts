import { IsUUID, IsDateString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class AssignPaddockDto {
  @IsUUID() paddock_id: string;
  @IsDateString() entry_date: string;
  @IsNumber() entry_head_count: number;
}

export class ExitPaddockDto {
  @IsDateString() exit_date: string;
  @IsNumber() exit_head_count: number;
  @IsEnum(['sold', 'moved', 'deceased', 'other']) exit_reason: string;
}
