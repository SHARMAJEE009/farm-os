import { Injectable, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';
import { CreateSpeciesDto, CreateBreedDto, CreateAnimalClassDto } from './livestock-master.dto';

@Injectable()
export class LivestockMasterService {
  constructor(@Inject(DATABASE_POOL) private db: Pool) {}

  // Species
  async findAllSpecies() {
    const { rows } = await this.db.query('SELECT * FROM species ORDER BY name');
    return rows;
  }

  async createSpecies(dto: CreateSpeciesDto) {
    const { rows } = await this.db.query(
      'INSERT INTO species (name, weight_unit, notes) VALUES ($1, $2, $3) RETURNING *',
      [dto.name, dto.weight_unit ?? 'kg', dto.notes ?? null]
    );
    return rows[0];
  }

  // Breeds
  async findAllBreeds(speciesId?: string) {
    const query = speciesId 
      ? 'SELECT * FROM breed WHERE species_id = $1 ORDER BY name'
      : 'SELECT * FROM breed ORDER BY name';
    const params = speciesId ? [speciesId] : [];
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async createBreed(dto: CreateBreedDto) {
    const { rows } = await this.db.query(
      'INSERT INTO breed (species_id, name, typical_mature_weight_kg, purpose) VALUES ($1, $2, $3, $4) RETURNING *',
      [dto.species_id, dto.name, dto.typical_mature_weight_kg ?? null, dto.purpose]
    );
    return rows[0];
  }

  // Animal Classes
  async findAllAnimalClasses(speciesId?: string) {
    const query = speciesId 
      ? 'SELECT * FROM animal_class WHERE species_id = $1 ORDER BY name'
      : 'SELECT * FROM animal_class ORDER BY name';
    const params = speciesId ? [speciesId] : [];
    const { rows } = await this.db.query(query, params);
    return rows;
  }

  async createAnimalClass(dto: CreateAnimalClassDto) {
    const { rows } = await this.db.query(
      'INSERT INTO animal_class (species_id, name) VALUES ($1, $2) RETURNING *',
      [dto.species_id, dto.name]
    );
    return rows[0];
  }
}
