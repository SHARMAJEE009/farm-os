import { IsString, IsOptional, IsEnum, IsNumber, IsUUID } from 'class-validator';

export class CreateSpeciesDto {
  @IsString() name: string;
  @IsOptional() @IsString() weight_unit?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateBreedDto {
  @IsUUID() species_id: string;
  @IsString() name: string;
  @IsOptional() @IsNumber() typical_mature_weight_kg?: number;
  @IsEnum(['meat', 'dairy', 'wool', 'breeding', 'dual']) purpose: string;
}

export class CreateAnimalClassDto {
  @IsUUID() species_id: string;
  @IsString() name: string;
}
