-- 1. Ensure Unique Constraints exist
DO $$ 
BEGIN
    -- species
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'species_name_key') THEN
        ALTER TABLE species ADD CONSTRAINT species_name_key UNIQUE (name);
    END IF;
    
    -- breed
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'breed_species_id_name_key') THEN
        ALTER TABLE breed ADD CONSTRAINT breed_species_id_name_key UNIQUE (species_id, name);
    END IF;

    -- animal_class
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'animal_class_species_id_name_key') THEN
        ALTER TABLE animal_class ADD CONSTRAINT animal_class_species_id_name_key UNIQUE (species_id, name);
    END IF;
END $$;

-- 2. Seed initial livestock species
INSERT INTO species (id, name, weight_unit, notes) VALUES
  (gen_random_uuid(), 'Cattle', 'kg', 'Bovine livestock'),
  (gen_random_uuid(), 'Sheep', 'kg', 'Ovine livestock'),
  (gen_random_uuid(), 'Pigs', 'kg', 'Porcine livestock')
ON CONFLICT (name) DO NOTHING;

-- 3. Seed initial animal classes
INSERT INTO animal_class (id, species_id, name)
SELECT gen_random_uuid(), id, unnest(ARRAY['Heifers', 'Steers', 'Bulls', 'Cows', 'Calves'])
FROM species WHERE name = 'Cattle'
ON CONFLICT (species_id, name) DO NOTHING;

INSERT INTO animal_class (id, species_id, name)
SELECT gen_random_uuid(), id, unnest(ARRAY['Ewes', 'Wethers', 'Rams', 'Lambs'])
FROM species WHERE name = 'Sheep'
ON CONFLICT (species_id, name) DO NOTHING;

-- 4. Seed initial breeds
INSERT INTO breed (id, species_id, name, typical_mature_weight_kg, purpose)
SELECT gen_random_uuid(), id, 'Angus', 600, 'meat'
FROM species WHERE name = 'Cattle'
ON CONFLICT (species_id, name) DO NOTHING;

INSERT INTO breed (id, species_id, name, typical_mature_weight_kg, purpose)
SELECT gen_random_uuid(), id, 'Hereford', 580, 'meat'
FROM species WHERE name = 'Cattle'
ON CONFLICT (species_id, name) DO NOTHING;

INSERT INTO breed (id, species_id, name, typical_mature_weight_kg, purpose)
SELECT gen_random_uuid(), id, 'Merino', 55, 'wool'
FROM species WHERE name = 'Sheep'
ON CONFLICT (species_id, name) DO NOTHING;
