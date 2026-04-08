-- ============================================================
-- FARM OS — Migration 002: Add extended fields to paddocks
-- Run this against an existing database to apply new columns
-- ============================================================

ALTER TABLE paddocks
  ADD COLUMN IF NOT EXISTS country     TEXT,
  ADD COLUMN IF NOT EXISTS city        TEXT,
  ADD COLUMN IF NOT EXISTS latitude    FLOAT,
  ADD COLUMN IF NOT EXISTS longitude   FLOAT,
  ADD COLUMN IF NOT EXISTS land_area   FLOAT,
  ADD COLUMN IF NOT EXISTS description TEXT;
