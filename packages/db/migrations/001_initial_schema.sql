-- ============================================================
-- FARM OS — PostgreSQL DDL Script
-- Run this in pgAdmin Query Tool or via psql
-- Order matters: parent tables created before child tables
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. FARMS
CREATE TABLE IF NOT EXISTS farms (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT        NOT NULL,
    location      TEXT,
    country       TEXT        NOT NULL DEFAULT 'Australia',
    created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS
CREATE TYPE IF NOT EXISTS user_role AS ENUM ('owner','manager','staff','agronomist','supplier');

CREATE TABLE IF NOT EXISTS users (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT        NOT NULL,
    email          TEXT        NOT NULL UNIQUE,
    password_hash  TEXT        NOT NULL,
    role           user_role   NOT NULL,
    farm_id        UUID        REFERENCES farms(id) ON DELETE SET NULL,
    created_at     TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. PADDOCKS
CREATE TABLE IF NOT EXISTS paddocks (
    id                UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id           UUID      NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    name              TEXT      NOT NULL,
    area_hectares     FLOAT,
    crop_type         TEXT,
    boundary_geojson  JSONB,
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. RECOMMENDATIONS
CREATE TYPE IF NOT EXISTS recommendation_status AS ENUM ('draft','approved','rejected');

CREATE TABLE IF NOT EXISTS recommendations (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    paddock_id      UUID                    NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
    agronomist_id   UUID                    REFERENCES users(id) ON DELETE SET NULL,
    type            TEXT                    NOT NULL,
    description     TEXT,
    status          recommendation_status   NOT NULL DEFAULT 'draft',
    created_at      TIMESTAMP               NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. PAYMENTS
CREATE TYPE IF NOT EXISTS payment_status AS ENUM ('pending','completed','failed','refunded');

CREATE TABLE IF NOT EXISTS payments (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    amount      FLOAT           NOT NULL CHECK (amount >= 0),
    method      TEXT,
    status      payment_status  NOT NULL DEFAULT 'pending',
    paid_at     TIMESTAMP,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. SUPPLIER_ORDERS
CREATE TYPE IF NOT EXISTS order_status AS ENUM ('pending','ordered','delivered');

CREATE TABLE IF NOT EXISTS supplier_orders (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id         UUID            REFERENCES users(id) ON DELETE SET NULL,
    paddock_id          UUID            NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
    recommendation_id   UUID            REFERENCES recommendations(id) ON DELETE SET NULL,
    payment_id          UUID            REFERENCES payments(id) ON DELETE SET NULL,
    product_name        TEXT            NOT NULL,
    quantity            FLOAT           NOT NULL CHECK (quantity > 0),
    unit_price          FLOAT           NOT NULL CHECK (unit_price >= 0),
    total_price         FLOAT           GENERATED ALWAYS AS (quantity * unit_price) STORED,
    status              order_status    NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. TIMESHEETS
CREATE TABLE IF NOT EXISTS timesheets (
    id            UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    paddock_id    UUID      NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
    payment_id    UUID      REFERENCES payments(id) ON DELETE SET NULL,
    hours         FLOAT     NOT NULL CHECK (hours > 0),
    hourly_rate   FLOAT     NOT NULL CHECK (hourly_rate >= 0),
    total_cost    FLOAT     GENERATED ALWAYS AS (hours * hourly_rate) STORED,
    date          DATE      NOT NULL DEFAULT CURRENT_DATE
);

-- 8. FUEL_LOGS
CREATE TABLE IF NOT EXISTS fuel_logs (
    id               UUID      PRIMARY KEY DEFAULT gen_random_uuid(),
    paddock_id       UUID      NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
    payment_id       UUID      REFERENCES payments(id) ON DELETE SET NULL,
    litres           FLOAT     NOT NULL CHECK (litres > 0),
    price_per_litre  FLOAT     NOT NULL CHECK (price_per_litre >= 0),
    total_cost       FLOAT     GENERATED ALWAYS AS (litres * price_per_litre) STORED,
    date             DATE      NOT NULL DEFAULT CURRENT_DATE
);

-- 9. FINANCIAL_TRANSACTIONS
CREATE TYPE IF NOT EXISTS transaction_source AS ENUM ('labour','fuel','supplier');

CREATE TABLE IF NOT EXISTS financial_transactions (
    id            UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    paddock_id    UUID                NOT NULL REFERENCES paddocks(id) ON DELETE CASCADE,
    source        transaction_source  NOT NULL,
    reference_id  UUID,
    amount        FLOAT               NOT NULL CHECK (amount >= 0),
    created_at    TIMESTAMP           NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_farm_id              ON users(farm_id);
CREATE INDEX IF NOT EXISTS idx_paddocks_farm_id           ON paddocks(farm_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_paddock_id ON recommendations(paddock_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_agro_id    ON recommendations(agronomist_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_paddock    ON supplier_orders(paddock_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_rec        ON supplier_orders(recommendation_id);
CREATE INDEX IF NOT EXISTS idx_supplier_orders_payment    ON supplier_orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_user_id         ON timesheets(user_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_paddock_id      ON timesheets(paddock_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_payment_id      ON timesheets(payment_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_paddock_id       ON fuel_logs(paddock_id);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_payment_id       ON fuel_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_tx_paddock_id    ON financial_transactions(paddock_id);

-- DONE
