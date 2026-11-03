import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';

export const prerender = false;

// GET /api/rider/earnings?riderId=BSL-RIDER-8942
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const riderId = url.searchParams.get('riderId') || 'BSL-RIDER-8942';

    const rider = ServerFleetEngine.getRider(riderId);

    // Dynamic breakdown based on real stats
    const todayOrders = rider.todayCompletedCount;
    const totalEarned = rider.todayEarningsAmount;
    const basePay = Math.round(totalEarned * 0.75);
    const distancePay = Math.round(totalEarned * 0.15);
    const tips = totalEarned - basePay - distancePay;

    return new Response(
      JSON.stringify({
        success: true,
        riderId,
        today: {
          totalEarnings: totalEarned,
          completedOrders: todayOrders,
          basePay,
          distancePay,
          tips,
          dutyHours: todayOrders > 0 ? (todayOrders * 0.7).toFixed(1) : '0.0',
          kmTravelled: todayOrders > 0 ? (todayOrders * 3.2).toFixed(1) : '0.0'
        },
        wallet: {
          balance: rider.walletBalance,
          bankAccount: 'SBI •••• 8942',
          upiId: 'rahulpatil@okaxis',
          payoutSchedule: 'Daily Auto-Settlement at 11:59 PM'
        },
        recentHistory: [
          {
            id: 'TXN-8941',
            type: 'DELIVERY_PAYOUT',
            title: 'Mahafresh Robusta Banana Express',
            category: 'GROCERY',
            amount: 48,
            timestamp: 'Today, 2:15 PM',
            status: 'CREDITED'
          },
          {
            id: 'TXN-8940',
            type: 'DELIVERY_PAYOUT',
            title: 'Khandesh Darbar Shev Bhaji Thali',
            category: 'FOOD',
            amount: 55,
            timestamp: 'Today, 1:40 PM',
            status: 'CREDITED'
          },
          {
            id: 'TXN-8939',
            type: 'DELIVERY_PAYOUT',
            title: 'Sanjeevani Medico Emergency Delivery',
            category: 'MEDICINE',
            amount: 65,
            timestamp: 'Today, 12:10 PM',
            status: 'CREDITED'
          }
        ]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Server error getting earnings.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
