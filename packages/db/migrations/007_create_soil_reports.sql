CREATE TABLE IF NOT EXISTS soil_reports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  paddock_id            UUID        NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
  farm_id               UUID        REFERENCES farms(id) ON DELETE CASCADE,

  -- File / report meta
  file_name             TEXT,
  lab_name              TEXT,
  adviser_name          TEXT,
  sample_date           TEXT,

  -- Crop / target
  crop                  TEXT,
  target_yield_t_ha     NUMERIC,
  soil_texture          TEXT,
  soil_type             TEXT,

  -- Soil health
  ph_topsoil            NUMERIC,
  ph_topsoil_status     TEXT,
  ph_subsoil            NUMERIC,
  ph_subsoil_status     TEXT,
  organic_carbon        NUMERIC,
  organic_carbon_status TEXT,
  ec_topsoil            NUMERIC,

  -- Macronutrients
  nitrate_n             NUMERIC,
  nitrate_n_status      TEXT,
  phosphorus            NUMERIC,
  phosphorus_status     TEXT,
  potassium             NUMERIC,
  potassium_status      TEXT,
  sulfate_s             NUMERIC,
  sulfate_s_status      TEXT,
  calcium               NUMERIC,
  calcium_status        TEXT,
  magnesium             NUMERIC,
  magnesium_status      TEXT,

  -- Micronutrients
  zinc                  NUMERIC,
  zinc_status           TEXT,
  copper                NUMERIC,
  copper_status         TEXT,
  manganese             NUMERIC,
  boron                 NUMERIC,

  -- N budget
  recommended_n_rate    NUMERIC,

  -- Fertiliser rates (kg/ha from report)
  n_rate_kg_ha          NUMERIC,
  p_rate_kg_ha          NUMERIC,
  s_rate_kg_ha          NUMERIC,
  zn_rate_kg_ha         NUMERIC,

  -- Product recommendations JSON array
  recommendations       JSONB,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_soil_reports_paddock ON soil_reports(paddock_id);
CREATE INDEX IF NOT EXISTS idx_soil_reports_farm    ON soil_reports(farm_id);
