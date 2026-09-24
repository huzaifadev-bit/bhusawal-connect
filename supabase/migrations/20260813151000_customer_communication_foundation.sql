-- ====================================================================
-- BHUSAWAL CONNECT — STEP 10C-1
-- CUSTOMER COMMUNICATION & CONSENT FOUNDATION MIGRATION
-- ====================================================================

-- 1. Customer Communication Preferences Table
CREATE TABLE IF NOT EXISTS public.customer_communication_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    transactional_sms_enabled BOOLEAN NOT NULL DEFAULT true,
    order_sms_enabled BOOLEAN NOT NULL DEFAULT true,
    delivery_sms_enabled BOOLEAN NOT NULL DEFAULT true,
    marketing_sms_enabled BOOLEAN NOT NULL DEFAULT false,
    marketing_email_enabled BOOLEAN NOT NULL DEFAULT false,
    marketing_whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    marketing_sms_updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customer_communication_preferences_customer_id_key UNIQUE (customer_id)
);

-- 2. Communication Events & Audit Log Table
CREATE TABLE IF NOT EXISTS public.communication_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'sms',
    message_type TEXT NOT NULL CHECK (message_type IN ('otp', 'order_confirmation', 'order_status', 'delivery_update', 'marketing')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'cancelled')),
    provider TEXT NOT NULL DEFAULT 'msg91',
    provider_message_id TEXT,
    idempotency_key TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for customer performance & idempotency lookups
CREATE INDEX IF NOT EXISTS idx_communication_preferences_customer ON public.customer_communication_preferences(customer_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_customer ON public.communication_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_communication_events_idempotency ON public.communication_events(idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.customer_communication_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for customer_communication_preferences
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can view own communication preferences') THEN
        CREATE POLICY "Customers can view own communication preferences"
            ON public.customer_communication_preferences FOR SELECT
            USING (
                customer_id IN (
                    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can update own communication preferences') THEN
        CREATE POLICY "Customers can update own communication preferences"
            ON public.customer_communication_preferences FOR UPDATE
            USING (
                customer_id IN (
                    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can insert own communication preferences') THEN
        CREATE POLICY "Customers can insert own communication preferences"
            ON public.customer_communication_preferences FOR INSERT
            WITH CHECK (
                customer_id IN (
                    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers can view own communication events') THEN
        CREATE POLICY "Customers can view own communication events"
            ON public.communication_events FOR SELECT
            USING (
                customer_id IN (
                    SELECT id FROM public.customers WHERE auth_user_id = auth.uid()
                )
            );
    END IF;
END $$;
