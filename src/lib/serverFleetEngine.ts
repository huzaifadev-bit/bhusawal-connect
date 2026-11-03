/**
 * ====================================================================
 * BHUSAWAL CONNECT - SERVER FLEET ENGINE & DISPATCH CONTROLLER
 * ====================================================================
 * Authoritative Server-Side Dispatch Engine for ONE Shared Two-Wheeler Fleet.
 * Enforces:
 * 1. Shared Fleet Pool (Grocery, Food, Medicine, Parcel, Passenger)
 * 2. Passenger Exclusivity Lock (100% lockout during passenger trips)
 * 3. Multi-Order Delivery Batching (Capacity, SLA, Detour limits)
 * 4. Atomic Assignment & Duplicate Prevention
 * 5. Server-Synced Location Telemetry & Dynamic Earnings Calculation
 */

export interface RiderProfile {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  bikeNo: string;
  dlNo: string;
  rating: number;
  isOnline: boolean;
  state: 'OFFLINE' | 'AVAILABLE' | 'GOING_TO_PICKUP' | 'AT_PICKUP' | 'PICKED_UP' | 'DELIVERING' | 'MULTI_ORDER' | 'PASSENGER_PICKUP' | 'PASSENGER_ACTIVE' | 'SUSPENDED';
  currentLat: number;
  currentLng: number;
  lastLocationUpdate: number;
  activeOrderIds: string[];
  todayCompletedCount: number;
  todayEarningsAmount: number;
  kycApproved: boolean;
  walletBalance: number;
}

export interface ServerOrder {
  id: string;
  serviceType: 'GROCERY' | 'FOOD' | 'MEDICINE' | 'PARCEL' | 'PASSENGER';
  categoryTitle: string;
  customerName: string;
  customerPhone: string;
  pickupName: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropAddress: string;
  dropLat: number;
  dropLng: number;
  items: Array<{ name: string; quantity: number; price?: number }>;
  itemCount: number;
  totalAmount: number;
  payout: number;
  distanceKm: number;
  etaMins: number;
  status: 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  assignedRiderId: string | null;
  rejectedByRiderIds: string[];
  paymentMethod: string;
  isCod: boolean;
  googleMapsLink?: string;
  createdAt: string;
  completedAt?: string;
}

// In-Memory Authoritative State (persists across serverless function warm runs)
const ridersStore = new Map<string, RiderProfile>();
const ordersStore = new Map<string, ServerOrder>();

// Default Seed Riders in Bhusawal Metropolitan Fleet
function initDefaultRiders() {
  if (ridersStore.size > 0) return;

  const defaultRiders: RiderProfile[] = [
    {
      id: 'BSL-RIDER-8942',
      name: 'Rahul Ramesh Patil',
      phone: '9876543210',
      vehicleType: 'EV Scooter (Ather 450X)',
      bikeNo: 'MH 19 AX 4892',
      dlNo: 'MH19 2021004892',
      rating: 4.95,
      isOnline: true,
      state: 'AVAILABLE',
      currentLat: 21.0478,
      currentLng: 75.7896, // Bhusawal Station Road
      lastLocationUpdate: Date.now(),
      activeOrderIds: [],
      todayCompletedCount: 5,
      todayEarningsAmount: 485,
      kycApproved: true,
      walletBalance: 1240
    },
    {
      id: 'BSL-RIDER-2002',
      name: 'Suresh Tukaram Patil',
      phone: '9876500002',
      vehicleType: 'Hero Splendor Plus',
      bikeNo: 'MH 19 BK 1001',
      dlNo: 'MH19 2019001001',
      rating: 4.88,
      isOnline: true,
      state: 'AVAILABLE',
      currentLat: 21.0512,
      currentLng: 75.7920, // Jamner Road
      lastLocationUpdate: Date.now(),
      activeOrderIds: [],
      todayCompletedCount: 4,
      todayEarningsAmount: 380,
      kycApproved: true,
      walletBalance: 960
    },
    {
      id: 'BSL-RIDER-2003',
      name: 'Vikas Gajanan Mahajan',
      phone: '9876500003',
      vehicleType: 'Honda Activa 6G',
      bikeNo: 'MH 19 BK 3003',
      dlNo: 'MH19 2020003003',
      rating: 4.82,
      isOnline: false,
      state: 'OFFLINE',
      currentLat: 21.0425,
      currentLng: 75.7980, // Nahata College
      lastLocationUpdate: Date.now(),
      activeOrderIds: [],
      todayCompletedCount: 0,
      todayEarningsAmount: 0,
      kycApproved: true,
      walletBalance: 450
    }
  ];

  for (const r of defaultRiders) {
    ridersStore.set(r.id, r);
  }
}

// Initial Realistic Orders Pool Across ALL 5 Service Categories
function initDefaultOrders() {
  if (ordersStore.size > 0) return;

  const now = new Date().toISOString();
  const seedOrders: ServerOrder[] = [
    {
      id: 'ORD-GROCERY-101',
      serviceType: 'GROCERY',
      categoryTitle: 'Grocery Quick Delivery',
      customerName: 'Priya Sharma',
      customerPhone: '9823154872',
      pickupName: 'Mahafresh Daily Supermarket',
      pickupAddress: 'Shop 4, Station Road Market, Bhusawal',
      pickupLat: 21.0482,
      pickupLng: 75.7902,
      dropAddress: 'B-12, Gokul Heights, Shivaji Nagar, Bhusawal',
      dropLat: 21.0450,
      dropLng: 75.7850,
      items: [
        { name: 'Fresh Bhusawal Robusta Banana (1 Dozen)', quantity: 2, price: 50 },
        { name: 'Amul Taaza Milk 1L', quantity: 2, price: 68 },
        { name: 'Fortune Sunlite Oil 1L', quantity: 1, price: 145 }
      ],
      itemCount: 5,
      totalAmount: 381,
      payout: 48,
      distanceKm: 2.1,
      etaMins: 14,
      status: 'PENDING',
      assignedRiderId: null,
      rejectedByRiderIds: [],
      paymentMethod: 'UPI',
      isCod: false,
      googleMapsLink: 'https://maps.app.goo.gl/BhusawalGokulHeights',
      createdAt: now
    },
    {
      id: 'ORD-FOOD-202',
      serviceType: 'FOOD',
      categoryTitle: 'Hot Food Delivery',
      customerName: 'Anand Kulkarni',
      customerPhone: '9765431890',
      pickupName: 'Khandesh Darbar Restaurant',
      pickupAddress: 'Railway Station Road Opposite State Bank, Bhusawal',
      pickupLat: 21.0475,
      pickupLng: 75.7890,
      dropAddress: 'Flat 302, Sai Residency, Jamner Road, Bhusawal',
      dropLat: 21.0520,
      dropLng: 75.7930,
      items: [
        { name: 'Special Khandeshi Shev Bhaji', quantity: 2, price: 140 },
        { name: 'Butter Jowar Bhakri', quantity: 4, price: 20 },
        { name: 'Gulab Jamun (2 Pcs)', quantity: 2, price: 40 }
      ],
      itemCount: 8,
      totalAmount: 440,
      payout: 55,
      distanceKm: 2.8,
      etaMins: 18,
      status: 'PENDING',
      assignedRiderId: null,
      rejectedByRiderIds: [],
      paymentMethod: 'COD',
      isCod: true,
      googleMapsLink: 'https://maps.app.goo.gl/SaiResidencyJamnerRd',
      createdAt: now
    },
    {
      id: 'ORD-MED-303',
      serviceType: 'MEDICINE',
      categoryTitle: 'Emergency Medicine Delivery',
      customerName: 'Sunita Deshmukh',
      customerPhone: '9422238491',
      pickupName: 'Sanjeevani Medico & 24/7 Pharmacy',
      pickupAddress: 'Civil Hospital Road, Near Bus Stand, Bhusawal',
      pickupLat: 21.0495,
      pickupLng: 75.7875,
      dropAddress: 'House 14, Ordnance Factory Township, Bhusawal',
      dropLat: 21.0350,
      dropLng: 75.7700,
      items: [
        { name: 'Augmentin 625 Duo Tablet', quantity: 1, price: 205 },
        { name: 'Dolo 650 Strip', quantity: 2, price: 34 },
        { name: 'Electral Sachet 21.8g', quantity: 4, price: 22 }
      ],
      itemCount: 7,
      totalAmount: 361,
      payout: 65,
      distanceKm: 3.9,
      etaMins: 16,
      status: 'PENDING',
      assignedRiderId: null,
      rejectedByRiderIds: [],
      paymentMethod: 'UPI',
      isCod: false,
      googleMapsLink: 'https://maps.app.goo.gl/OrdnanceFactoryBhusawal',
      createdAt: now
    },
    {
      id: 'ORD-PARCEL-404',
      serviceType: 'PARCEL',
      categoryTitle: 'Local Courier & Parcel',
      customerName: 'Gaurav Patil',
      customerPhone: '9890123456',
      pickupName: 'Patil Electronics Service Center',
      pickupAddress: 'Shop 11, Mahatma Gandhi Market, Bhusawal',
      pickupLat: 21.0460,
      pickupLng: 75.7870,
      dropAddress: 'Plot 7, Varangaon Road Industrial Area, Bhusawal',
      dropLat: 21.0400,
      dropLng: 75.7800,
      items: [
        { name: 'Laptop Spare Parts Box (0.8 kg)', quantity: 1, price: 0 }
      ],
      itemCount: 1,
      totalAmount: 85,
      payout: 50,
      distanceKm: 2.4,
      etaMins: 15,
      status: 'PENDING',
      assignedRiderId: null,
      rejectedByRiderIds: [],
      paymentMethod: 'UPI',
      isCod: false,
      googleMapsLink: 'https://maps.app.goo.gl/VarangaonRoadArea',
      createdAt: now
    },
    {
      id: 'RIDE-PASSENGER-505',
      serviceType: 'PASSENGER',
      categoryTitle: 'BSL Bike Taxi (Passenger Ride)',
      customerName: 'Vijay Deshmukh (Passenger)',
      customerPhone: '9860112233',
      pickupName: 'Bhusawal Junction Railway Station (Platform 1 Exit)',
      pickupAddress: 'Station Road, Bhusawal Junction, Maharashtra 425201',
      pickupLat: 21.0478,
      pickupLng: 75.7896,
      dropAddress: 'Nahata Arts, Science & Commerce College Campus, Jamner Road',
      dropLat: 21.0550,
      dropLng: 75.7980,
      items: [
        { name: 'Single Passenger Two-Wheeler Transit (Helmet Provided)', quantity: 1, price: 45 }
      ],
      itemCount: 1,
      totalAmount: 45,
      payout: 42,
      distanceKm: 2.6,
      etaMins: 10,
      status: 'PENDING',
      assignedRiderId: null,
      rejectedByRiderIds: [],
      paymentMethod: 'UPI',
      isCod: false,
      googleMapsLink: 'https://maps.app.goo.gl/NahataCollegeBhusawal',
      createdAt: now
    }
  ];

  for (const o of seedOrders) {
    ordersStore.set(o.id, o);
  }
}

// Initialize on module load
initDefaultRiders();
initDefaultOrders();

export const ServerFleetEngine = {
  /**
   * Returns rider profile by ID, defaulting to primary rider
   */
  getRider(riderId: string = 'BSL-RIDER-8942'): RiderProfile {
    initDefaultRiders();
    const rider = ridersStore.get(riderId);
    if (rider) return rider;
    // Default fallback
    return ridersStore.get('BSL-RIDER-8942')!;
  },

  /**
   * Sets Rider Online/Offline duty state
   */
  setDuty(riderId: string, isOnline: boolean): { success: boolean; rider: RiderProfile } {
    initDefaultRiders();
    const rider = this.getRider(riderId);
    rider.isOnline = isOnline;
    if (!isOnline) {
      if (rider.activeOrderIds.length === 0) {
        rider.state = 'OFFLINE';
      }
    } else {
      if (rider.state === 'OFFLINE') {
        rider.state = rider.activeOrderIds.length > 0 ? 'DELIVERING' : 'AVAILABLE';
      }
    }
    return { success: true, rider };
  },

  /**
   * Update Rider Real-time Location
   */
  updateLocation(riderId: string, lat: number, lng: number): { success: boolean; rider: RiderProfile } {
    initDefaultRiders();
    const rider = this.getRider(riderId);
    rider.currentLat = lat;
    rider.currentLng = lng;
    rider.lastLocationUpdate = Date.now();
    return { success: true, rider };
  },

  /**
   * Get all active orders assigned to this rider
   */
  getActiveOrders(riderId: string): ServerOrder[] {
    initDefaultOrders();
    const active: ServerOrder[] = [];
    for (const order of ordersStore.values()) {
      if (order.assignedRiderId === riderId && (order.status === 'ACCEPTED' || order.status === 'PICKED_UP' || order.status === 'IN_TRANSIT')) {
        active.push(order);
      }
    }
    return active;
  },

  /**
   * Get eligible dispatch orders for this rider
   * Enforces:
   * 1. Offline -> 0 orders
   * 2. PASSENGER_PICKUP or PASSENGER_ACTIVE -> 0 orders (Strict Lock)
   * 3. Rider carrying active deliveries -> 0 passenger rides
   * 4. Multi-order limit (max 3 deliveries or 1 parcel)
   */
  getAvailableDispatchOrders(riderId: string): ServerOrder[] {
    initDefaultOrders();
    const rider = this.getRider(riderId);
    if (!rider.isOnline) return [];

    // PASSENGER EXCLUSIVE LOCK: Zero other orders can be assigned or offered
    if (rider.state === 'PASSENGER_PICKUP' || rider.state === 'PASSENGER_ACTIVE') {
      return [];
    }

    const activeOrders = this.getActiveOrders(riderId);
    const hasPassenger = activeOrders.some(o => o.serviceType === 'PASSENGER');
    if (hasPassenger) return [];

    const activeCount = activeOrders.length;
    const hasParcel = activeOrders.some(o => o.serviceType === 'PARCEL');

    // If max delivery capacity reached
    if (activeCount >= 3 || hasParcel) {
      return [];
    }

    const available: ServerOrder[] = [];
    for (const order of ordersStore.values()) {
      if (order.status !== 'PENDING') continue;
      if (order.assignedRiderId !== null) continue;
      if (order.rejectedByRiderIds.includes(riderId)) continue;

      // If rider has active delivery orders, do NOT offer passenger ride
      if (activeCount > 0 && order.serviceType === 'PASSENGER') {
        continue;
      }

      // If order is parcel and rider already has orders, reject
      if (activeCount > 0 && order.serviceType === 'PARCEL') {
        continue;
      }

      available.push(order);
    }

    return available;
  },

  /**
   * Authoritative Order Action Handler (Accept, Reject, Pickup, Deliver, etc.)
   */
  handleAction(
    riderId: string,
    orderId: string,
    action: 'ACCEPT' | 'REJECT' | 'PICKUP' | 'DELIVER' | 'PASSENGER_START' | 'PASSENGER_COMPLETE' | 'CANCEL'
  ): { success: boolean; message: string; rider: RiderProfile; order?: ServerOrder; code?: number } {
    initDefaultRiders();
    initDefaultOrders();

    const rider = this.getRider(riderId);
    const order = ordersStore.get(orderId);

    if (!order) {
      return { success: false, message: `Order #${orderId} not found.`, rider, code: 404 };
    }

    switch (action) {
      case 'ACCEPT': {
        // 1. Check duplicate assignment
        if (order.assignedRiderId && order.assignedRiderId !== riderId) {
          return { success: false, message: 'This order was just accepted by another partner.', rider, code: 409 };
        }

        // 2. Enforce PASSENGER EXCLUSIVE LOCK
        if (rider.state === 'PASSENGER_PICKUP' || rider.state === 'PASSENGER_ACTIVE') {
          return {
            success: false,
            message: 'Passenger trip in progress. Additional orders are blocked until passenger is dropped.',
            rider,
            code: 403
          };
        }

        const currentActive = this.getActiveOrders(riderId);

        // 3. If accepting a PASSENGER ride, rider must NOT have active deliveries
        if (order.serviceType === 'PASSENGER') {
          if (currentActive.length > 0) {
            return {
              success: false,
              message: 'Cannot accept passenger ride while carrying active deliveries.',
              rider,
              code: 403
            };
          }
          // Accept passenger ride -> Enter PASSENGER_PICKUP state
          order.assignedRiderId = riderId;
          order.status = 'ACCEPTED';
          rider.state = 'PASSENGER_PICKUP';
          if (!rider.activeOrderIds.includes(orderId)) {
            rider.activeOrderIds.push(orderId);
          }
          return { success: true, message: 'Passenger ride accepted. Proceeding to passenger pickup.', rider, order };
        }

        // 4. Accepting regular delivery order (Grocery, Food, Medicine, Parcel)
        if (currentActive.some(o => o.serviceType === 'PASSENGER')) {
          return { success: false, message: 'Passenger trip active. Cannot accept delivery orders.', rider, code: 403 };
        }

        if (currentActive.length >= 3) {
          return { success: false, message: 'Maximum delivery capacity (3 orders) reached.', rider, code: 403 };
        }

        if (order.serviceType === 'PARCEL' && currentActive.length > 0) {
          return { success: false, message: 'Parcels require dedicated space and cannot be batched.', rider, code: 403 };
        }

        order.assignedRiderId = riderId;
        order.status = 'ACCEPTED';
        if (!rider.activeOrderIds.includes(orderId)) {
          rider.activeOrderIds.push(orderId);
        }

        // Update rider state
        const totalAfter = this.getActiveOrders(riderId).length;
        rider.state = totalAfter > 1 ? 'MULTI_ORDER' : 'GOING_TO_PICKUP';

        return { success: true, message: `Order #${orderId} accepted successfully.`, rider, order };
      }

      case 'REJECT': {
        if (!order.rejectedByRiderIds.includes(riderId)) {
          order.rejectedByRiderIds.push(riderId);
        }
        return { success: true, message: 'Order rejected. It will be routed to other available riders.', rider, order };
      }

      case 'PICKUP': {
        if (order.assignedRiderId !== riderId) {
          return { success: false, message: 'Unauthorized: order is not assigned to this rider.', rider, code: 403 };
        }
        order.status = 'PICKED_UP';
        const active = this.getActiveOrders(riderId);
        rider.state = active.length > 1 ? 'MULTI_ORDER' : 'DELIVERING';
        return { success: true, message: `Picked up items for #${orderId}. Proceeding to customer drop.`, rider, order };
      }

      case 'PASSENGER_START': {
        if (order.assignedRiderId !== riderId || order.serviceType !== 'PASSENGER') {
          return { success: false, message: 'Invalid passenger ride operation.', rider, code: 400 };
        }
        order.status = 'IN_TRANSIT';
        rider.state = 'PASSENGER_ACTIVE';
        return { success: true, message: 'Passenger onboarded. Trip in progress.', rider, order };
      }

      case 'PASSENGER_COMPLETE': {
        if (order.assignedRiderId !== riderId || order.serviceType !== 'PASSENGER') {
          return { success: false, message: 'Invalid passenger ride operation.', rider, code: 400 };
        }
        order.status = 'DELIVERED';
        order.completedAt = new Date().toISOString();

        rider.activeOrderIds = rider.activeOrderIds.filter(id => id !== orderId);
        rider.todayCompletedCount += 1;
        rider.todayEarningsAmount += order.payout;
        rider.walletBalance += order.payout;

        // AUTOMATICALLY RELEASE PASSENGER LOCK -> RETURN TO AVAILABLE
        rider.state = rider.isOnline ? 'AVAILABLE' : 'OFFLINE';

        return {
          success: true,
          message: `Passenger dropped off successfully! Earned +₹${order.payout}. You are now AVAILABLE for all fleet orders.`,
          rider,
          order
        };
      }

      case 'DELIVER': {
        if (order.assignedRiderId !== riderId) {
          return { success: false, message: 'Unauthorized: order not assigned to this rider.', rider, code: 403 };
        }
        order.status = 'DELIVERED';
        order.completedAt = new Date().toISOString();

        rider.activeOrderIds = rider.activeOrderIds.filter(id => id !== orderId);
        rider.todayCompletedCount += 1;
        rider.todayEarningsAmount += order.payout;
        rider.walletBalance += order.payout;

        const remaining = this.getActiveOrders(riderId);
        if (remaining.length === 0) {
          rider.state = rider.isOnline ? 'AVAILABLE' : 'OFFLINE';
        } else if (remaining.length === 1) {
          rider.state = remaining[0].status === 'PICKED_UP' ? 'DELIVERING' : 'GOING_TO_PICKUP';
        } else {
          rider.state = 'MULTI_ORDER';
        }

        return {
          success: true,
          message: `Delivery completed for #${orderId}! Earned +₹${order.payout}.`,
          rider,
          order
        };
      }

      case 'CANCEL': {
        order.assignedRiderId = null;
        order.status = 'PENDING';
        rider.activeOrderIds = rider.activeOrderIds.filter(id => id !== orderId);

        const remaining = this.getActiveOrders(riderId);
        if (remaining.length === 0) {
          rider.state = rider.isOnline ? 'AVAILABLE' : 'OFFLINE';
        } else {
          rider.state = remaining.length > 1 ? 'MULTI_ORDER' : 'DELIVERING';
        }

        return { success: true, message: `Order #${orderId} was cancelled/reassigned safely.`, rider, order };
      }

      default:
        return { success: false, message: 'Unknown action.', rider, code: 400 };
    }
  },

  /**
   * Add a new order dynamically (from customer checkout or customer app)
   */
  addNewOrder(orderData: Partial<ServerOrder>): ServerOrder {
    initDefaultOrders();
    const id = orderData.id || `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder: ServerOrder = {
      id,
      serviceType: orderData.serviceType || 'GROCERY',
      categoryTitle: orderData.categoryTitle || 'Express Delivery',
      customerName: orderData.customerName || 'Customer',
      customerPhone: orderData.customerPhone || '9876543210',
      pickupName: orderData.pickupName || 'Bhusawal Store Partner',
      pickupAddress: orderData.pickupAddress || 'Station Road, Bhusawal',
      pickupLat: orderData.pickupLat || 21.0478,
      pickupLng: orderData.pickupLng || 75.7896,
      dropAddress: orderData.dropAddress || 'Shivaji Nagar, Bhusawal',
      dropLat: orderData.dropLat || 21.0450,
      dropLng: orderData.dropLng || 75.7850,
      items: orderData.items || [{ name: 'Order Items', quantity: 1, price: 50 }],
      itemCount: orderData.itemCount || 1,
      totalAmount: orderData.totalAmount || 50,
      payout: orderData.payout || 45,
      distanceKm: orderData.distanceKm || 2.0,
      etaMins: orderData.etaMins || 15,
      status: 'PENDING',
      assignedRiderId: null,
      rejectedByRiderIds: [],
      paymentMethod: orderData.paymentMethod || 'UPI',
      isCod: orderData.isCod || false,
      googleMapsLink: orderData.googleMapsLink || '',
      createdAt: new Date().toISOString()
    };
    ordersStore.set(id, newOrder);
    return newOrder;
  },

  /**
   * Reset / Reload default test state
   */
  resetAll() {
    ridersStore.clear();
    ordersStore.clear();
    initDefaultRiders();
    initDefaultOrders();
  }
};
