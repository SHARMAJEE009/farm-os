-- Add free-text supplier_name to supplier_orders
ALTER TABLE supplier_orders ADD COLUMN IF NOT EXISTS supplier_name TEXT;
