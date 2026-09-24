-- BHUSAWAL CONNECT — STEP 2 MIGRATION: CUSTOMER DATABASE FOUNDATION

-- 1. Helper function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Create public.customers table
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID UNIQUE,
    phone TEXT,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

-- 3. Create public.customer_addresses table
CREATE TABLE IF NOT EXISTS public.customer_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    label TEXT,
    address_line TEXT NOT NULL,
    area TEXT,
    city TEXT DEFAULT 'Bhusawal',
    state TEXT DEFAULT 'Maharashtra',
    pincode TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create public.customer_events table
CREATE TABLE IF NOT EXISTS public.customer_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON public.customers(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON public.customers(email);
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_customer_id ON public.customer_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_events_event_type ON public.customer_events(event_type);
CREATE INDEX IF NOT EXISTS idx_customer_events_created_at ON public.customer_events(created_at);

-- 6. Attach updated_at triggers
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_customers_updated_at') THEN
        CREATE TRIGGER set_customers_updated_at
        BEFORE UPDATE ON public.customers
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_customer_addresses_updated_at') THEN
        CREATE TRIGGER set_customer_addresses_updated_at
        BEFORE UPDATE ON public.customer_addresses
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 7. Enable Row Level Security (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_events ENABLE ROW LEVEL SECURITY;

-- 8. Create RLS Policies
-- Customers table policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can read own profile' AND tablename = 'customers') THEN
        CREATE POLICY "Customers can read own profile" ON public.customers
            FOR SELECT USING (auth.uid() = auth_user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can update own profile' AND tablename = 'customers') THEN
        CREATE POLICY "Customers can update own profile" ON public.customers
            FOR UPDATE USING (auth.uid() = auth_user_id);
    END IF;

-- Customer addresses table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can read own addresses' AND tablename = 'customer_addresses') THEN
        CREATE POLICY "Customers can read own addresses" ON public.customer_addresses
            FOR SELECT USING (
                customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can insert own addresses' AND tablename = 'customer_addresses') THEN
        CREATE POLICY "Customers can insert own addresses" ON public.customer_addresses
            FOR INSERT WITH CHECK (
                customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can update own addresses' AND tablename = 'customer_addresses') THEN
        CREATE POLICY "Customers can update own addresses" ON public.customer_addresses
            FOR UPDATE USING (
                customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can delete own addresses' AND tablename = 'customer_addresses') THEN
        CREATE POLICY "Customers can delete own addresses" ON public.customer_addresses
            FOR DELETE USING (
                customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
            );
    END IF;

-- Customer events table policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can read own events' AND tablename = 'customer_events') THEN
        CREATE POLICY "Customers can read own events" ON public.customer_events
            FOR SELECT USING (
                customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can insert own events' AND tablename = 'customer_events') THEN
        CREATE POLICY "Customers can insert own events" ON public.customer_events
            FOR INSERT WITH CHECK (
                customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
            );
    END IF;
END $$;
