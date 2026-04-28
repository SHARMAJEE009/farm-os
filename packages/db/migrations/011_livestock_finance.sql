-- 1. Update health_event to include cost_amount
ALTER TABLE health_event ADD COLUMN IF NOT EXISTS cost_amount DECIMAL(10,2) DEFAULT 0;

-- 2. Update mob_paddock_assignment to include sale_price_per_head
ALTER TABLE mob_paddock_assignment ADD COLUMN IF NOT EXISTS sale_price_per_head DECIMAL(10,2);

-- 3. Update financial_transactions to allow nullable paddock_id
ALTER TABLE financial_transactions ALTER COLUMN paddock_id DROP NOT NULL;

-- 4. Update transaction_source enum to include 'livestock'
-- Since it's an enum, we need to add the value
ALTER TYPE transaction_source ADD VALUE IF NOT EXISTS 'livestock';
