-- Migration 006: Add extra fields to farms table
ALTER TABLE farms
  ADD COLUMN IF NOT EXISTS description        TEXT,
  ADD COLUMN IF NOT EXISTS state              TEXT,
  ADD COLUMN IF NOT EXISTS postcode           TEXT,
  ADD COLUMN IF NOT EXISTS total_area_hectares FLOAT;
