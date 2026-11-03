-- ====================================================================
-- BHUSAWAL CONNECT — STEP 7 MIGRATION: RIDER FLEET FOUNDATION
-- ====================================================================
-- Persistent PostgreSQL Schema for Shared Two-Wheeler Fleet Management.
-- Tables:
-- 1. public.riders
-- 2. public.rider_assignments
-- 3. public.rider_locations
-- 4. public.rider_wallet_transactions
--
-- Features:
-- - Strict Foreign Key Integrity & Constraints
-- - Atomic Concurrency Row Locking via Stored Procedures
-- - Passenger Exclusive State Enforcement (100% lockout during trips)
-- - Zero Duplicate Order Assignments
-- - Row Level Security (RLS) Policies
-- ====================================================================

-- 1. CREATE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE: public.riders
CREATE TABLE IF NOT EXISTS public.riders (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    vehicle_type TEXT NOT NULL DEFAULT 'EV Scooter',
    bike_no TEXT NOT NULL,
    dl_no TEXT NOT NULL,
    rating NUMERIC(3, 2) DEFAULT 5.00 CHECK (rating >= 1.00 AND rating <= 5.00),
    kyc_approved BOOLEAN DEFAULT true,
    is_online BOOLEAN DEFAULT false,
    state TEXT NOT NULL DEFAULT 'OFFLINE' CHECK (
        state IN (
            'OFFLINE',
            'AVAILABLE',
            'GOING_TO_PICKUP',
            'AT_PICKUP',
            'PICKED_UP',
            'DELIVERING',
            'MULTI_ORDER',
            'PASSENGER_PICKUP',
            'PASSENGER_ACTIVE',
            'SUSPENDED'
        )
    ),
    current_lat DOUBLE PRECISION DEFAULT 21.0478,
    current_lng DOUBLE PRECISION DEFAULT 75.7896,
    last_location_update TIMESTAMPTZ DEFAULT NOW(),
    wallet_balance NUMERIC(10, 2) DEFAULT 0.00 CHECK (wallet_balance >= 0.00),
    today_completed_count INT DEFAULT 0 CHECK (today_completed_count >= 0),
    today_earnings_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (today_earnings_amount >= 0.00),
    profile_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLE: public.rider_assignments
CREATE TABLE IF NOT EXISTS public.rider_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id TEXT NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    order_id TEXT NOT NULL,
    service_category TEXT NOT NULL CHECK (
        service_category IN ('GROCERY', 'FOOD', 'MEDICINE', 'PARCEL', 'PASSENGER')
    ),
    status TEXT NOT NULL DEFAULT 'ACCEPTED' CHECK (
        status IN ('OFFERED', 'ACCEPTED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'REJECTED', 'CANCELLED')
    ),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    payout NUMERIC(10, 2) DEFAULT 0.00 CHECK (payout >= 0.00),
    assignment_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Strict Concurrency Guard: An order can have at most ONE active assignment at any given time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_order_assignment 
ON public.rider_assignments (order_id) 
WHERE status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT');

-- 4. TABLE: public.rider_locations
CREATE TABLE IF NOT EXISTS public.rider_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id TEXT NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION DEFAULT 0.0,
    speed DOUBLE PRECISION DEFAULT 0.0,
    accuracy DOUBLE PRECISION DEFAULT 10.0,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLE: public.rider_wallet_transactions
CREATE TABLE IF NOT EXISTS public.rider_wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rider_id TEXT NOT NULL REFERENCES public.riders(id) ON DELETE CASCADE,
    order_id TEXT,
    type TEXT NOT NULL CHECK (
        type IN ('DELIVERY_PAYOUT', 'PASSENGER_PAYOUT', 'WITHDRAWAL', 'BONUS', 'INCENTIVE', 'DEDUCTION')
    ),
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'CREDITED' CHECK (
        status IN ('PENDING', 'CREDITED', 'FAILED', 'SETTLED')
    ),
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INDEXES FOR HIGH-THROUGHPUT DISPATCH QUERYING
CREATE INDEX IF NOT EXISTS idx_riders_phone ON public.riders(phone);
CREATE INDEX IF NOT EXISTS idx_riders_state ON public.riders(state);
CREATE INDEX IF NOT EXISTS idx_riders_is_online ON public.riders(is_online);
CREATE INDEX IF NOT EXISTS idx_rider_assignments_rider_id ON public.rider_assignments(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_assignments_status ON public.rider_assignments(status);
CREATE INDEX IF NOT EXISTS idx_rider_assignments_order_id ON public.rider_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_rider_locations_rider_id ON public.rider_locations(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_locations_recorded_at ON public.rider_locations(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_rider_wallet_rider_id ON public.rider_wallet_transactions(rider_id);
CREATE INDEX IF NOT EXISTS idx_rider_wallet_created_at ON public.rider_wallet_transactions(created_at DESC);

-- 7. TRIGGER: AUTOMATIC updated_at TIMESTAMPS
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_riders_updated_at') THEN
        CREATE TRIGGER set_riders_updated_at
        BEFORE UPDATE ON public.riders
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_rider_assignments_updated_at') THEN
        CREATE TRIGGER set_rider_assignments_updated_at
        BEFORE UPDATE ON public.rider_assignments
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    -- Riders Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read riders' AND tablename = 'riders') THEN
        CREATE POLICY "Public read riders" ON public.riders FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service/Admin modify riders' AND tablename = 'riders') THEN
        CREATE POLICY "Service/Admin modify riders" ON public.riders FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Rider Assignments Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read assignments' AND tablename = 'rider_assignments') THEN
        CREATE POLICY "Public read assignments" ON public.rider_assignments FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service/Admin modify assignments' AND tablename = 'rider_assignments') THEN
        CREATE POLICY "Service/Admin modify assignments" ON public.rider_assignments FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Rider Locations Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read locations' AND tablename = 'rider_locations') THEN
        CREATE POLICY "Public read locations" ON public.rider_locations FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service/Admin modify locations' AND tablename = 'rider_locations') THEN
        CREATE POLICY "Service/Admin modify locations" ON public.rider_locations FOR ALL USING (true) WITH CHECK (true);
    END IF;

    -- Rider Wallet Transactions Policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read wallet' AND tablename = 'rider_wallet_transactions') THEN
        CREATE POLICY "Public read wallet" ON public.rider_wallet_transactions FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service/Admin modify wallet' AND tablename = 'rider_wallet_transactions') THEN
        CREATE POLICY "Service/Admin modify wallet" ON public.rider_wallet_transactions FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 9. ATOMIC STORED PROCEDURE: ACCEPT ORDER (ATOMIC CONCURRENCY & PASSENGER EXCLUSIVITY)
CREATE OR REPLACE FUNCTION public.fn_accept_order_atomic(
    p_rider_id TEXT,
    p_order_id TEXT,
    p_service_category TEXT,
    p_payout NUMERIC DEFAULT 45.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rider RECORD;
    v_active_count INT;
    v_active_passenger INT;
    v_active_parcel INT;
    v_existing_assignment RECORD;
    v_new_state TEXT;
    v_assignment_id UUID;
BEGIN
    -- 1. Acquire exclusive row-level lock on the rider
    SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 404, 'message', 'Rider partner not found.');
    END IF;

    IF NOT v_rider.is_online THEN
        RETURN jsonb_build_object('success', false, 'code', 400, 'message', 'Rider is currently offline. Go on duty to accept orders.');
    END IF;

    -- 2. Check PASSENGER EXCLUSIVE LOCK: Zero orders permitted while passenger trip is active
    IF v_rider.state IN ('PASSENGER_PICKUP', 'PASSENGER_ACTIVE') THEN
        RETURN jsonb_build_object(
            'success', false,
            'code', 403,
            'message', 'Passenger trip in progress. Additional orders are blocked until passenger is dropped.'
        );
    END IF;

    -- 3. Check duplicate acceptance on the order (Strict Concurrency Lock)
    SELECT * INTO v_existing_assignment 
    FROM public.rider_assignments 
    WHERE order_id = p_order_id AND status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT')
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing_assignment.rider_id = p_rider_id THEN
            RETURN jsonb_build_object('success', true, 'code', 200, 'message', 'Order already accepted by this rider.', 'assignment_id', v_existing_assignment.id);
        ELSE
            RETURN jsonb_build_object('success', false, 'code', 409, 'message', 'This order was just accepted by another partner.');
        END IF;
    END IF;

    -- 4. Calculate current active orders for rider
    SELECT COUNT(*) INTO v_active_count 
    FROM public.rider_assignments 
    WHERE rider_id = p_rider_id AND status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT');

    SELECT COUNT(*) INTO v_active_passenger 
    FROM public.rider_assignments 
    WHERE rider_id = p_rider_id AND service_category = 'PASSENGER' AND status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT');

    SELECT COUNT(*) INTO v_active_parcel 
    FROM public.rider_assignments 
    WHERE rider_id = p_rider_id AND service_category = 'PARCEL' AND status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT');

    -- 5. Enforce Service Category Rules:
    -- If accepting a PASSENGER ride:
    IF p_service_category = 'PASSENGER' THEN
        IF v_active_count > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 403,
                'message', 'Cannot accept passenger ride while carrying active deliveries.'
            );
        END IF;
        v_new_state := 'PASSENGER_PICKUP';
    ELSE
        -- If accepting regular delivery order:
        IF v_active_passenger > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 403,
                'message', 'Passenger trip active. Cannot accept delivery orders.'
            );
        END IF;

        IF v_active_count >= 3 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 403,
                'message', 'Maximum delivery capacity (3 orders) reached.'
            );
        END IF;

        IF (p_service_category = 'PARCEL' AND v_active_count > 0) OR v_active_parcel > 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'code', 403,
                'message', 'Parcels require dedicated space and cannot be batched with other deliveries.'
            );
        END IF;

        v_new_state := CASE WHEN v_active_count >= 1 THEN 'MULTI_ORDER' ELSE 'GOING_TO_PICKUP' END;
    END IF;

    -- 6. Insert new assignment
    INSERT INTO public.rider_assignments (
        rider_id, order_id, service_category, status, payout, assigned_at
    ) VALUES (
        p_rider_id, p_order_id, p_service_category, 'ACCEPTED', p_payout, NOW()
    ) RETURNING id INTO v_assignment_id;

    -- 7. Update rider state
    UPDATE public.riders 
    SET state = v_new_state, updated_at = NOW() 
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', 200,
        'message', 'Order #' || p_order_id || ' accepted successfully.',
        'assignment_id', v_assignment_id,
        'rider_state', v_new_state
    );
END;
$$;

-- 10. ATOMIC STORED PROCEDURE: COMPLETE ORDER (EARNINGS CREDIT & AUTO-RELEASE)
CREATE OR REPLACE FUNCTION public.fn_complete_order_atomic(
    p_rider_id TEXT,
    p_order_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_assignment RECORD;
    v_rider RECORD;
    v_remaining_count INT;
    v_new_state TEXT;
    v_txn_type TEXT;
BEGIN
    -- 1. Lock assignment
    SELECT * INTO v_assignment 
    FROM public.rider_assignments 
    WHERE rider_id = p_rider_id AND order_id = p_order_id AND status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT')
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'code', 404, 'message', 'Active order assignment not found for this rider.');
    END IF;

    -- 2. Mark assignment delivered
    UPDATE public.rider_assignments 
    SET status = 'DELIVERED', delivered_at = NOW(), updated_at = NOW() 
    WHERE id = v_assignment.id;

    -- 3. Determine transaction type
    v_txn_type := CASE WHEN v_assignment.service_category = 'PASSENGER' THEN 'PASSENGER_PAYOUT' ELSE 'DELIVERY_PAYOUT' END;

    -- 4. Credit wallet and record transaction
    INSERT INTO public.rider_wallet_transactions (
        rider_id, order_id, type, amount, status, description
    ) VALUES (
        p_rider_id, p_order_id, v_txn_type, v_assignment.payout, 'CREDITED', 
        'Payout for completed order #' || p_order_id
    );

    -- 5. Lock and update rider totals
    SELECT * INTO v_rider FROM public.riders WHERE id = p_rider_id FOR UPDATE;

    SELECT COUNT(*) INTO v_remaining_count 
    FROM public.rider_assignments 
    WHERE rider_id = p_rider_id AND status IN ('ACCEPTED', 'PICKED_UP', 'IN_TRANSIT');

    v_new_state := CASE 
        WHEN NOT v_rider.is_online THEN 'OFFLINE'
        WHEN v_remaining_count = 0 THEN 'AVAILABLE'
        WHEN v_remaining_count = 1 THEN 'DELIVERING'
        ELSE 'MULTI_ORDER'
    END;

    UPDATE public.riders 
    SET 
        state = v_new_state,
        wallet_balance = wallet_balance + v_assignment.payout,
        today_completed_count = today_completed_count + 1,
        today_earnings_amount = today_earnings_amount + v_assignment.payout,
        updated_at = NOW()
    WHERE id = p_rider_id;

    RETURN jsonb_build_object(
        'success', true,
        'code', 200,
        'message', 'Order #' || p_order_id || ' delivered successfully! +₹' || v_assignment.payout || ' credited.',
        'payout', v_assignment.payout,
        'remaining_active_orders', v_remaining_count,
        'rider_state', v_new_state
    );
END;
$$;

-- 11. PRE-SEED FLEET RIDERS
INSERT INTO public.riders (
    id, name, phone, email, vehicle_type, bike_no, dl_no, rating, kyc_approved, is_online, state, current_lat, current_lng, wallet_balance, today_completed_count, today_earnings_amount
) VALUES 
(
    'BSL-RIDER-8942',
    'Rahul Ramesh Patil',
    '9876543210',
    'rahul.patil@bslconnect.in',
    'EV Scooter (Ather 450X)',
    'MH 19 AX 4892',
    'MH19 2021004892',
    4.95,
    true,
    true,
    'AVAILABLE',
    21.0478,
    75.7896,
    1240.00,
    5,
    485.00
),
(
    'BSL-RIDER-2002',
    'Suresh Tukaram Patil',
    '9876500002',
    'suresh.patil@bslconnect.in',
    'Hero Splendor Plus',
    'MH 19 BK 1001',
    'MH19 2019001001',
    4.88,
    true,
    true,
    'AVAILABLE',
    21.0512,
    75.7920,
    960.00,
    4,
    380.00
),
(
    'BSL-RIDER-2003',
    'Vikas Gajanan Mahajan',
    '9876500003',
    'vikas.mahajan@bslconnect.in',
    'Honda Activa 6G',
    'MH 19 BK 3003',
    'MH19 2020003003',
    4.82,
    true,
    false,
    'OFFLINE',
    21.0425,
    75.7980,
    450.00,
    0,
    0.00
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    vehicle_type = EXCLUDED.vehicle_type,
    bike_no = EXCLUDED.bike_no,
    dl_no = EXCLUDED.dl_no,
    updated_at = NOW();
