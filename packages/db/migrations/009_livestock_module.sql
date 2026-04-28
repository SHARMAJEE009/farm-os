-- ============================================================
-- FARM OS — Migration 009: Livestock Module
-- Run this in pgAdmin Query Tool or via psql
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'breed_purpose') THEN
        CREATE TYPE breed_purpose AS ENUM ('meat', 'dairy', 'wool', 'breeding', 'dual');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mob_status') THEN
        CREATE TYPE mob_status AS ENUM ('active', 'sold', 'deceased', 'transferred');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'mob_exit_reason') THEN
        CREATE TYPE mob_exit_reason AS ENUM ('sold', 'moved', 'deceased', 'other');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'health_event_type') THEN
        CREATE TYPE health_event_type AS ENUM ('treatment', 'vaccination', 'mortality', 'condition_score');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'livestock_entry_type') THEN
        CREATE TYPE livestock_entry_type AS ENUM ('purchase', 'feed', 'treatment', 'sale');
    END IF;
END $$;


-- ─── 1. SPECIES ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS species (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT        NOT NULL UNIQUE,
    weight_unit  TEXT        NOT NULL DEFAULT 'kg',
    notes        TEXT,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 2. BREED ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS breed (
    id                        UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id                UUID           NOT NULL REFERENCES species(id) ON DELETE CASCADE,
    name                      TEXT           NOT NULL,
    typical_mature_weight_kg  DECIMAL(8,2),
    purpose                   breed_purpose  NOT NULL,
    created_at                TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(species_id, name)
);

-- ─── 3. ANIMAL_CLASS ─────────────────────────────────────────
-- e.g. Cow, Bull, Heifer, Steer, Ewe, Ram, Wether, Lamb

CREATE TABLE IF NOT EXISTS animal_class (
    id          UUID       PRIMARY KEY DEFAULT gen_random_uuid(),
    species_id  UUID       NOT NULL REFERENCES species(id) ON DELETE CASCADE,
    name        TEXT       NOT NULL,
    created_at  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(species_id, name)
);

-- ─── 4. MOB ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mob (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    TEXT        NOT NULL,
    species_id              UUID        NOT NULL REFERENCES species(id) ON DELETE RESTRICT,
    breed_id                UUID        REFERENCES breed(id) ON DELETE SET NULL,
    animal_class_id         UUID        REFERENCES animal_class(id) ON DELETE SET NULL,
    head_count              INT         NOT NULL DEFAULT 0,
    dob_range_start         DATE,
    dob_range_end           DATE,
    source_farm             VARCHAR(255),
    purchase_date           DATE,
    purchase_price_per_head DECIMAL(10,2),
    status                  mob_status  NOT NULL DEFAULT 'active',
    farm_id                 UUID        NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    created_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 5. MOB_PADDOCK_ASSIGNMENT ───────────────────────────────

CREATE TABLE IF NOT EXISTS mob_paddock_assignment (
    id                   UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    mob_id               UUID               NOT NULL REFERENCES mob(id) ON DELETE CASCADE,
    paddock_id           UUID               NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
    entry_date           DATE               NOT NULL,
    entry_head_count     INT                NOT NULL,
    exit_date            DATE,
    exit_head_count      INT,
    exit_reason          mob_exit_reason,
    stocking_rate_per_ha DECIMAL(8,2),
    created_at           TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 6. WEIGH_EVENT ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weigh_event (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    mob_id              UUID          NOT NULL REFERENCES mob(id) ON DELETE CASCADE,
    date                DATE          NOT NULL,
    head_count_weighed  INT           NOT NULL,
    average_weight_kg   DECIMAL(8,2)  NOT NULL,
    total_weight_kg     DECIMAL(10,2) GENERATED ALWAYS AS (head_count_weighed * average_weight_kg) STORED,
    adg_since_last_kg   DECIMAL(6,3),
    notes               TEXT,
    recorded_by         UUID          REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 7. HEALTH_EVENT ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS health_event (
    id                       UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    mob_id                   UUID              NOT NULL REFERENCES mob(id) ON DELETE CASCADE,
    event_type               health_event_type NOT NULL,
    date                     DATE              NOT NULL,
    product_used             VARCHAR(255),
    dose                     VARCHAR(100),
    withholding_period_days  INT,
    whp_expiry_date          DATE,
    administered_by          UUID              REFERENCES users(id) ON DELETE SET NULL,
    head_count_affected      INT               NOT NULL DEFAULT 0,
    cause                    VARCHAR(255),
    notes                    TEXT,
    created_at               TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── 8. LIVESTOCK_FINANCIAL_ENTRY ────────────────────────────

CREATE TABLE IF NOT EXISTS livestock_financial_entry (
    id                       UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
    mob_id                   UUID                  NOT NULL REFERENCES mob(id) ON DELETE CASCADE,
    paddock_id               UUID                  REFERENCES paddocks(id) ON DELETE SET NULL,
    entry_type               livestock_entry_type  NOT NULL,
    amount                   DECIMAL(12,2)         NOT NULL,
    date                     DATE                  NOT NULL,
    notes                    TEXT,
    financial_transaction_id UUID                  REFERENCES financial_transactions(id) ON DELETE SET NULL,
    created_at               TIMESTAMP             NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── INDEXES ─────────────────────────────────────────────────

-- mob_paddock_assignment
CREATE INDEX IF NOT EXISTS idx_mob_paddock_assignment_paddock_id ON mob_paddock_assignment(paddock_id);
CREATE INDEX IF NOT EXISTS idx_mob_paddock_assignment_mob_id     ON mob_paddock_assignment(mob_id);

-- health_event
CREATE INDEX IF NOT EXISTS idx_health_event_mob_event_type       ON health_event(mob_id, event_type);

-- mob
CREATE INDEX IF NOT EXISTS idx_mob_farm_id                       ON mob(farm_id);
CREATE INDEX IF NOT EXISTS idx_mob_species_id                    ON mob(species_id);
CREATE INDEX IF NOT EXISTS idx_mob_status                        ON mob(status);

-- breed & animal_class
CREATE INDEX IF NOT EXISTS idx_breed_species_id                  ON breed(species_id);
CREATE INDEX IF NOT EXISTS idx_animal_class_species_id           ON animal_class(species_id);

-- weigh_event
CREATE INDEX IF NOT EXISTS idx_weigh_event_mob_id                ON weigh_event(mob_id);

-- livestock_financial_entry
CREATE INDEX IF NOT EXISTS idx_livestock_fin_entry_mob_id        ON livestock_financial_entry(mob_id);

-- DONE
