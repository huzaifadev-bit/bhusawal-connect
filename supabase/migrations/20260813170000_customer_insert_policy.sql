-- ====================================================================
-- BHUSAWAL CONNECT — HARDENED CUSTOMER INSERT RLS POLICY
-- ====================================================================

-- Ensure strict auth.uid() = auth_user_id check on INSERT for public.customers
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can insert own profile' AND tablename = 'customers') THEN
        CREATE POLICY "Customers can insert own profile" ON public.customers
            FOR INSERT WITH CHECK (
                auth.uid() IS NOT NULL AND auth.uid() = auth_user_id
            );
    END IF;
END $$;
