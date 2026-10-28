# 🚀 Bhusawal Connect — Hyperlocal Super-App & Fleet Engine

> **Live Production Deployment on Vercel**:  
> 🌐 **[https://bhusawal-connect.vercel.app](https://bhusawal-connect.vercel.app)**

Bhusawal Connect is a high-performance hyperlocal commerce, delivery, and shared-fleet mobility platform built for Bhusawal, Maharashtra.

---

## 🌐 Live Vercel Application Links

| Portal / Module | Live Vercel URL | Description |
|---|---|---|
| **🛍️ Customer Storefront** | [https://bhusawal-connect.vercel.app/](https://bhusawal-connect.vercel.app/) | Universal storefront (Grocery, Food, Medicine, Parcel, Bike Taxi) |
| **🛵 BSL Rider Partner App** | [https://bhusawal-connect.vercel.app/rider](https://bhusawal-connect.vercel.app/rider) | Map-first live partner app with duty toggle, multi-order queue, passenger lock, wallet & profile |
| **📡 Fleet Dispatch Control** | [https://bhusawal-connect.vercel.app/admin_fleet](https://bhusawal-connect.vercel.app/admin_fleet) | Live 6-vertical dispatch simulator, parameter tuning & explainability scoring |
| **📍 Live Order Tracking** | [https://bhusawal-connect.vercel.app/track_order](https://bhusawal-connect.vercel.app/track_order) | 8-stage canonical timeline with Leaflet / Google Maps telemetry |
| **📊 Super Admin Dashboard** | [https://bhusawal-connect.vercel.app/admin](https://bhusawal-connect.vercel.app/admin) | Analytics, merchant management, orders, and platform metrics |

---

## 🛵 Shared Two-Wheeler Fleet Engine

BSL Connect operates on **ONE shared two-wheeler fleet**:
- **6 Verticals**: 🛒 Grocery, 🍔 Food, 💊 Medicine, 📦 Parcel, 🔄 Pickup & Drop, 🛵 Passenger Bike Taxi.
- **Strict Passenger Mode**: `PASSENGER_PICKUP` and `PASSENGER_ACTIVE` lock the vehicle exclusively. Zero batching permitted until passenger dropped.
- **Multi-Order Detour Limits**: Automatic corridor detection ($\le 1.2\text{ km}$, $\le 6\text{ min}$ SLA). Hot food and urgent medicine protected from excessive detours.
- **Race Condition Guard**: Server-side atomic checks prevent duplicate assignments if two partners click accept simultaneously.

---

## 🧪 Automated Test Suite

Run the full 20-scenario suite and regression suites locally:
```bash
# 20 Comprehensive Operational Scenarios
node scripts/test_all_20_rider_scenarios.cjs

# All 8 Regression Test Suites
node -e "['scripts/test_shared_fleet_dispatch.cjs','scripts/test_rider_fleet_engine.cjs','scripts/test_active_multi_order_system.cjs','scripts/test_passenger_workflow.cjs','scripts/test_earnings_profile.cjs','scripts/test_rider_map_experience.cjs','scripts/test_order_request_experience.cjs','scripts/test_all_20_rider_scenarios.cjs'].forEach(s => require('child_process').execSync('node ' + s, { stdio: 'inherit' }));"
```
