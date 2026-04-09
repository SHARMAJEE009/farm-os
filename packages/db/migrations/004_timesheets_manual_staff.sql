-- ============================================================
-- FARM OS — Migration 004: Allow manual staff name on timesheets
-- Run this against an existing database
-- ============================================================

-- Allow logging hours without a user account
ALTER TABLE timesheets ALTER COLUMN user_id DROP NOT NULL;

-- Store the manually entered name when user_id is NULL
ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS staff_name TEXT;
