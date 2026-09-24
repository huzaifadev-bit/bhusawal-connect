-- BHUSAWAL CONNECT — STEP 6 MIGRATION: ORDER OWNERSHIP FOUNDATION

-- 1. Create public.orders table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    legacy_order_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'PLACED',
    payment_status TEXT DEFAULT 'PENDING',
    payment_method TEXT,
    total_amount NUMERIC,
    order_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create public.order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id TEXT,
    product_name_snapshot TEXT,
    quantity INT DEFAULT 1,
    unit_price NUMERIC,
    subtotal NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_legacy_order_id ON public.orders(legacy_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 4. Trigger for updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_orders_updated_at') THEN
        CREATE TRIGGER set_orders_updated_at
        BEFORE UPDATE ON public.orders
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can read own orders' AND tablename = 'orders') THEN
        CREATE POLICY "Customers can read own orders" ON public.orders
            FOR SELECT USING (
                customer_id IN (SELECT id FROM public.customers WHERE auth_user_id = auth.uid())
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can read own order items' AND tablename = 'order_items') THEN
        CREATE POLICY "Customers can read own order items" ON public.order_items
            FOR SELECT USING (
                order_id IN (
                    SELECT id FROM public.orders WHERE customer_id IN (
                        SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;
