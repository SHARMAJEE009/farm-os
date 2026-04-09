-- ============================================================
-- FARM OS — Migration 003: Replace area_hectares with sowing_date
-- Run this against an existing database
-- ============================================================

ALTER TABLE paddocks DROP COLUMN IF EXISTS area_hectares;
ALTER TABLE paddocks ADD COLUMN IF NOT EXISTS sowing_date DATE;
