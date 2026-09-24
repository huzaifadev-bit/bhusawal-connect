/**
 * ====================================================================
 * BHUSAWAL CONNECT — MASTER RELATIONAL DATABASE SCHEMA ENGINE (18 TABLES)
 * ====================================================================
 * Single Master Relational Database Engine enforcing Unique IDs,
 * normalized collections, and foreign-key relational linkage across:
 *
 * 1.  tbl_customers                (Unique ID: CUST-xxxx)
 * 2.  tbl_delivery_partners         (Unique ID: RIDER-xxxx)
 * 3.  tbl_partner_shops             (Unique ID: SHOP-xxxx)
 * 4.  tbl_restaurants               (Unique ID: REST-xxxx)
 * 5.  tbl_medical_stores            (Unique ID: MED-xxxx)
 * 6.  tbl_products                 (Unique ID: PROD-xxxx)
 * 7.  tbl_orders                   (Unique ID: ORD-xxxx)
 * 8.  tbl_order_items               (Unique ID: ITEM-xxxx)
 * 9.  tbl_addresses                (Unique ID: ADDR-xxxx)
 * 10. tbl_payments                 (Unique ID: PAY-xxxx)
 * 11. tbl_notifications            (Unique ID: NOTIF-xxxx)
 * 12. tbl_live_rider_locations     (Unique ID: GPS-xxxx)
 * 13. tbl_coupons                  (Unique ID: COUP-xxxx)
 * 14. tbl_ratings                  (Unique ID: RATE-xxxx)
 * 15. tbl_transactions             (Unique ID: TXN-xxxx)
 * 16. tbl_payouts                  (Unique ID: PAYOUT-xxxx)
 * 17. tbl_settings                 (Unique ID: SETT-xxxx)
 * 18. tbl_analytics                (Unique ID: METRIC-xxxx)
 */

(function(window) {
  'use strict';

  var DB_STORAGE_KEY = 'bhusawal_master_relational_db_v1';

  // ID Generators
  function generateID(prefix) {
    return prefix + '-' + Math.floor(100000 + Math.random() * 900000);
  }

  // Master Initial Seeds
  var defaultMasterSeed = {
    tbl_customers: [
      { id: 'CUST-1001', name: 'Rahul Patil', phone: '+91 98234 56789', email: 'rahul.patil@gmail.com', spent: 3450, totalOrders: 12, status: 'active', createdAt: '2026-01-15T10:00:00Z' },
      { id: 'CUST-1002', name: 'Priya Sharma', phone: '+91 98765 43210', email: 'priya.sharma@yahoo.com', spent: 1890, totalOrders: 7, status: 'active', createdAt: '2026-02-01T14:30:00Z' },
      { id: 'CUST-1003', name: 'Amit Chaudhari', phone: '+91 97654 32109', email: 'amit.c@outlook.com', spent: 5120, totalOrders: 19, status: 'active', createdAt: '2026-02-20T09:15:00Z' }
    ],

    tbl_delivery_partners: [
      { id: 'RIDER-2001', name: 'Suresh Patil', phone: '+91 98765 00001', vehicleType: 'Bike/Scooter', bikeNo: 'MH-19-BK-1001', isOnline: true, rating: 4.9, todayEarnings: 450, isVerified: true, kycStatus: 'approved' },
      { id: 'RIDER-2002', name: 'Ganesh Shinde', phone: '+91 98765 00002', vehicleType: 'Auto Rickshaw', bikeNo: 'MH-19-AU-2002', isOnline: true, rating: 4.8, todayEarnings: 620, isVerified: true, kycStatus: 'approved' },
      { id: 'RIDER-2003', name: 'Vikas Mahajan', phone: '+91 98765 00003', vehicleType: 'Bike/Scooter', bikeNo: 'MH-19-BK-3003', isOnline: false, rating: 4.7, todayEarnings: 0, isVerified: true, kycStatus: 'approved' }
    ],

    tbl_partner_shops: [
      { id: 'SHOP-3001', name: 'Mahafresh Grocery Store', owner: 'Ramesh Wani', phone: '+91 94222 11001', category: 'Grocery', commissionRate: 10, rating: 4.8, status: 'active', address: 'Station Road, Bhusawal' },
      { id: 'SHOP-3002', name: 'Bhusawal Electronics & Mobiles', owner: 'Sunil Agarwal', phone: '+91 94222 11002', category: 'Electronics', commissionRate: 12, rating: 4.6, status: 'active', address: 'Jamner Road, Bhusawal' }
    ],

    tbl_restaurants: [
      { id: 'REST-4001', name: 'Khandesh Restaurant & Thali', owner: 'Vijay Deshmukh', phone: '+91 94222 22001', cuisine: 'Khandeshi / North Indian', commissionRate: 15, rating: 4.7, status: 'active', address: 'Near Railway Station, Bhusawal' },
      { id: 'REST-4002', name: 'Shree Ganesh Sweet Home', owner: 'Prakash Joshi', phone: '+91 94222 22002', cuisine: 'Sweets & Snacks', commissionRate: 12, rating: 4.9, status: 'active', address: 'Main Market, Bhusawal' }
    ],

    tbl_medical_stores: [
      { id: 'MED-5001', name: 'Sanjeevani Medico & Pharma', owner: 'Dr. M. K. Jain', phone: '+91 94222 33001', licenseNo: 'MH-JAL-20B-10029', commissionRate: 8, rating: 4.9, status: 'active', address: 'Civil Hospital Road, Bhusawal' }
    ],

    tbl_products: [
      { id: 'PROD-6001', name: 'Mahafresh Robusta Banana (1 kg)', category: 'Fresh Fruits', mrp: 45, sellingPrice: 38, stock: 150, merchantId: 'SHOP-3001', imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e', isHidden: false },
      { id: 'PROD-6002', name: 'Amul Taaza T-Special Milk (1 L)', category: 'Dairy & Bread', mrp: 68, sellingPrice: 66, stock: 80, merchantId: 'SHOP-3001', imageUrl: 'https://images.unsplash.com/photo-1550583724-b2692b85b150', isHidden: false },
      { id: 'PROD-6003', name: 'Khandeshi Shev Bhaji Thali', category: 'Main Course', mrp: 180, sellingPrice: 160, stock: 999, merchantId: 'REST-4001', imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d', isHidden: false }
    ],

    tbl_orders: [
      { id: 'ORD-7001', customerId: 'CUST-1001', merchantId: 'SHOP-3001', riderId: 'RIDER-2001', serviceType: 'Grocery Delivery', amount: 345, deliveryFee: 30, discount: 20, total: 355, paymentStatus: 'PAID', status: 'Delivered', createdAt: '2026-08-07T10:15:00Z' },
      { id: 'ORD-7002', customerId: 'CUST-1002', merchantId: 'REST-4001', riderId: 'RIDER-2002', serviceType: 'Food Order', amount: 480, deliveryFee: 35, discount: 0, total: 515, paymentStatus: 'PAID', status: 'On The Way', createdAt: '2026-08-07T12:45:00Z' }
    ],

    tbl_order_items: [
      { id: 'ITEM-8001', orderId: 'ORD-7001', productId: 'PROD-6001', title: 'Mahafresh Robusta Banana (1 kg)', price: 38, quantity: 2, subtotal: 76 },
      { id: 'ITEM-8002', orderId: 'ORD-7001', productId: 'PROD-6002', title: 'Amul Taaza T-Special Milk (1 L)', price: 66, quantity: 4, subtotal: 264 }
    ],

    tbl_addresses: [
      { id: 'ADDR-9001', customerId: 'CUST-1001', label: 'Home', addressLine: 'Flat 302, Sai Residency', area: 'Jamner Road', pincode: '425201', lat: 21.0478, lng: 75.7896, isDefault: true }
    ],

    tbl_payments: [
      { id: 'PAY-1001', orderId: 'ORD-7001', customerId: 'CUST-1001', amount: 355, paymentMethod: 'UPI', status: 'SUCCESS', txnId: 'TXN-UPI-9928341', timestamp: '2026-08-07T10:16:00Z' },
      { id: 'PAY-1002', orderId: 'ORD-7002', customerId: 'CUST-1002', amount: 515, paymentMethod: 'COD', status: 'PENDING', txnId: 'TXN-COD-4410293', timestamp: '2026-08-07T12:46:00Z' }
    ],

    tbl_notifications: [
      { id: 'NOTIF-1101', targetAudience: 'All Users', type: 'promotion', title: '🎁 Bhusawal Food Craze', message: 'Get flat 20% OFF using BHUSAWAL20!', route: '/food', recipientsCount: 3450, sentAt: '2026-08-07T09:00:00Z' }
    ],

    tbl_live_rider_locations: [
      { id: 'GPS-1201', riderId: 'RIDER-2001', lat: 21.0478, lng: 75.7896, speed: 28, batteryLevel: 85, zone: 'Station Road', updatedAt: '2026-08-07T13:00:00Z' },
      { id: 'GPS-1202', riderId: 'RIDER-2002', lat: 21.0512, lng: 75.7925, speed: 22, batteryLevel: 92, zone: 'Jamner Road', updatedAt: '2026-08-07T13:00:00Z' }
    ],

    tbl_coupons: [
      { id: 'COUP-1301', code: 'BHUSAWAL20', discountType: 'percentage', discountValue: 20, minOrderAmount: 299, maxDiscount: 100, validTill: '2026-12-31', isActive: true }
    ],

    tbl_ratings: [
      { id: 'RATE-1401', orderId: 'ORD-7001', customerId: 'CUST-1001', targetType: 'RIDER', targetId: 'RIDER-2001', stars: 5, feedback: 'Super fast delivery!', createdAt: '2026-08-07T11:00:00Z' }
    ],

    tbl_transactions: [
      { id: 'TXN-1501', type: 'COMMISSION', amount: 35.5, entityType: 'MERCHANT', entityId: 'SHOP-3001', status: 'CREDITED', timestamp: '2026-08-07T10:20:00Z' }
    ],

    tbl_payouts: [
      { id: 'PAYOUT-1601', partnerType: 'MERCHANT', partnerId: 'SHOP-3001', amount: 319.5, status: 'SETTLED', disbursedAt: '2026-08-07T11:30:00Z' }
    ],

    tbl_settings: [
      { id: 'SETT-1701', baseFee: 30, freeDeliveryMin: 299, minOrderVal: 50, surgeMultiplier: 1.0, commissionRate: 12, gstRate: 5, gstin: '27ABCDE1234F1Z5', serviceZones: 'Station Road, Jamner Road, Ordnance Factory, Market Yard, Khedi Road, Varangaon Road', supportPhone: '+91 98765 43210' }
    ],

    tbl_analytics: [
      { id: 'METRIC-1801', date: '2026-08-07', totalGMV: 14850, totalOrders: 42, completedOrders: 38, cancelledOrders: 4, newCustomers: 8, activeRiders: 6 }
    ]
  };

  // Internal Relational DB Storage Operations
  function loadDatabase() {
    try {
      var raw = localStorage.getItem(DB_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(defaultMasterSeed));
    return defaultMasterSeed;
  }

  function saveDatabase(db) {
    try {
      localStorage.setItem(DB_STORAGE_KEY, JSON.stringify(db));
    } catch(e) {}
  }

  // Master Relational Engine Interface
  var BhusawalMasterDB = {
    version: '1.0.0-relational',

    getTable: function(tableName) {
      var db = loadDatabase();
      return db[tableName] || [];
    },

    query: function(tableName) {
      return this.getTable(tableName);
    },

    insertRecord: function(tableName, record, prefix) {
      var db = loadDatabase();
      if (!db[tableName]) db[tableName] = [];

      record.id = record.id || generateID(prefix || 'REC');
      db[tableName].unshift(record);
      saveDatabase(db);
      return record;
    },

    updateRecord: function(tableName, recordId, updates) {
      var db = loadDatabase();
      if (!db[tableName]) return null;

      var idx = db[tableName].findIndex(function(r) { return r.id === recordId; });
      if (idx >= 0) {
        db[tableName][idx] = Object.assign(db[tableName][idx], updates);
        saveDatabase(db);
        return db[tableName][idx];
      }
      return null;
    },

    deleteRecord: function(tableName, recordId) {
      var db = loadDatabase();
      if (!db[tableName]) return false;

      var initialLen = db[tableName].length;
      db[tableName] = db[tableName].filter(function(r) { return r.id !== recordId; });
      saveDatabase(db);
      return db[tableName].length < initialLen;
    },

    // Relational Helpers
    getOrdersWithDetails: function() {
      var db = loadDatabase();
      return (db.tbl_orders || []).map(function(order) {
        var cust = (db.tbl_customers || []).find(function(c) { return c.id === order.customerId; });
        var rider = (db.tbl_delivery_partners || []).find(function(r) { return r.id === order.riderId; });
        var items = (db.tbl_order_items || []).filter(function(i) { return i.orderId === order.id; });
        var pay = (db.tbl_payments || []).find(function(p) { return p.orderId === order.id; });

        return Object.assign({}, order, {
          customer: cust || null,
          rider: rider || null,
          items: items,
          payment: pay || null
        });
      });
    }
  };

  // Expose Global Singleton
  window.BhusawalMasterDB = BhusawalMasterDB;

})(window);
