-- ====================================================================
-- BHUSAWAL CONNECT — CUSTOMER PHONE UNIQUE INDEX & CONSTRAINT
-- ====================================================================

-- Guarantee database-level uniqueness for customer phone numbers
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_phone_key') THEN
        ALTER TABLE public.customers ADD CONSTRAINT customers_phone_key UNIQUE (phone);
    END IF;
END $$;
