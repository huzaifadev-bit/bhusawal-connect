-- ====================================================================
-- BHUSAWAL CONNECT — STEP 10C-3
-- CUSTOMER MARKETING & PROMOTIONAL FOUNDATION MIGRATION
-- ====================================================================

-- 1. Marketing Campaigns Table
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    message_template TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'sms',
    target_segment TEXT NOT NULL DEFAULT 'ALL_CUSTOMERS',
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    scheduled_at TIMESTAMPTZ,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Marketing Consent Audit Log Table
CREATE TABLE IF NOT EXISTS public.marketing_consent_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    previous_value BOOLEAN NOT NULL DEFAULT false,
    new_value BOOLEAN NOT NULL,
    source TEXT NOT NULL DEFAULT 'account_settings',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for marketing query performance
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status ON public.marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_marketing_consent_audit_customer ON public.marketing_consent_audit(customer_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_consent_audit ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can view own consent audit') THEN
        CREATE POLICY "Customers can view own consent audit"
            ON public.marketing_consent_audit FOR SELECT
            USING (
                customer_id IN (
                    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can insert own consent audit') THEN
        CREATE POLICY "Customers can insert own consent audit"
            ON public.marketing_consent_audit FOR INSERT
            WITH CHECK (
                customer_id IN (
                    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
                )
            );
    END IF;
END $$;
