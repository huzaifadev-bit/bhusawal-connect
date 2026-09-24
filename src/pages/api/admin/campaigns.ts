import type { APIRoute } from 'astro';
import { supabase } from '../../../lib/supabaseClient';
import { sendCustomerMarketingSms, isWithinMarketingQuietHours, type MarketingSegment } from '../../../lib/marketingService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { action, campaign, campaignId, status, isTestMode } = body;

    // 1. CALCULATE_RECIPIENTS
    if (action === 'CALCULATE_RECIPIENTS') {
      const targetSegment = (body.targetSegment || 'ALL_CUSTOMERS') as MarketingSegment;

      // Fetch all customer profiles
      const { data: customers } = await supabase
        .from('customers')
        .select('id, phone, created_at');

      const totalCustomers = customers ? customers.length : 0;
      let verifiedPhoneCount = 0;
      let marketingEnabledCount = 0;
      let frequencyBlockedCount = 0;
      let netEligibleCount = 0;

      if (customers && customers.length > 0) {
        for (const cust of customers) {
          if (!cust.phone) continue;
          verifiedPhoneCount++;

          const { data: prefs } = await supabase
            .from('customer_communication_preferences')
            .select('marketing_sms_enabled')
            .eq('customer_id', cust.id)
            .single();

          if (prefs?.marketing_sms_enabled) {
            marketingEnabledCount++;

            // Frequency limit check (1 in last 24h)
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { count: count24h } = await supabase
              .from('communication_events')
              .select('id', { count: 'exact', head: true })
              .eq('customer_id', cust.id)
              .eq('message_type', 'marketing')
              .gte('created_at', twentyFourHoursAgo);

            if ((count24h || 0) >= 1) {
              frequencyBlockedCount++;
            } else {
              netEligibleCount++;
            }
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          segment: targetSegment,
          stats: {
            totalCustomers,
            verifiedPhoneCount,
            marketingEnabledCount,
            frequencyBlockedCount,
            netEligibleCount,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2. CREATE_CAMPAIGN
    if (action === 'CREATE_CAMPAIGN') {
      if (!campaign || !campaign.name || !campaign.message_template) {
        return new Response(
          JSON.stringify({ success: false, error: 'Campaign name and message template are required.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data: created, error } = await supabase
        .from('marketing_campaigns')
        .insert({
          name: campaign.name,
          description: campaign.description || '',
          message_template: campaign.message_template,
          channel: 'sms',
          target_segment: campaign.target_segment || 'ALL_CUSTOMERS',
          status: 'DRAFT',
          scheduled_at: campaign.scheduled_at || null,
        })
        .select('*')
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true, campaign: created }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. UPDATE_STATUS (DRAFT, SCHEDULED, RUNNING, PAUSED, COMPLETED, CANCELLED)
    if (action === 'UPDATE_STATUS') {
      if (!campaignId || !status) {
        return new Response(
          JSON.stringify({ success: false, error: 'campaignId and status are required.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const validStatuses = ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return new Response(
          JSON.stringify({ success: false, error: `Invalid status '${status}'.` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data: updated, error } = await supabase
        .from('marketing_campaigns')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', campaignId)
        .select('*')
        .single();

      if (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(JSON.stringify({ success: true, campaign: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. DISPATCH_CAMPAIGN (Simulate or execute campaign sending)
    if (action === 'DISPATCH_CAMPAIGN') {
      if (!campaignId) {
        return new Response(
          JSON.stringify({ success: false, error: 'campaignId is required.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const { data: cmp } = await supabase
        .from('marketing_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (!cmp || cmp.status === 'CANCELLED' || cmp.status === 'COMPLETED') {
        return new Response(
          JSON.stringify({ success: false, error: 'Campaign cannot be dispatched (Invalid or finished state).' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Check Quiet Hours
      if (!isWithinMarketingQuietHours() && !isTestMode) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Dispatch restricted: Current time is outside allowed marketing hours (09:00 - 21:00 IST).',
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Update status to RUNNING
      await supabase
        .from('marketing_campaigns')
        .update({ status: 'RUNNING', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      // Fetch eligible customers
      const { data: customers } = await supabase.from('customers').select('id, phone, name');
      let dispatchedCount = 0;
      let skippedConsentCount = 0;

      if (customers) {
        for (const cust of customers) {
          const res = await sendCustomerMarketingSms({
            campaignId,
            customerId: cust.id,
            customerName: cust.name || 'Customer',
            phone: cust.phone || undefined,
            offerMessage: cmp.name,
            isTestMode: typeof isTestMode === 'boolean' ? isTestMode : true, // Default to Test Mode for safety!
          });

          if (res.success) {
            dispatchedCount++;
          } else {
            skippedConsentCount++;
          }
        }
      }

      // Mark campaign COMPLETED
      await supabase
        .from('marketing_campaigns')
        .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('id', campaignId);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Campaign dispatch completed successfully (${dispatchedCount} processed, ${skippedConsentCount} skipped).`,
          stats: {
            dispatchedCount,
            skippedConsentCount,
            isTestMode: typeof isTestMode === 'boolean' ? isTestMode : true,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Unknown action '${action}'.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[API admin/campaigns] Error:', err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || 'Server error.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async () => {
  try {
    const { data: campaigns } = await supabase
      .from('marketing_campaigns')
      .select('*')
      .order('created_at', { ascending: false });

    return new Response(
      JSON.stringify({
        status: 'active',
        campaigns: campaigns || [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
