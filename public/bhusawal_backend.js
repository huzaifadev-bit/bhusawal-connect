/**
 * ====================================================================
 * BHUSAWAL CONNECT — CENTRALIZED BACKEND ARCHITECTURE & REAL-TIME SYNC
 * ====================================================================
 * Single Source of Truth backed by Master Relational Database Engine (`BhusawalMasterDB`):
 * 1. Customer App (pages: home, cart, checkout, orders, track_order, food, grocery, parcel, bike_ride, medicines)
 * 2. Delivery Partner App (page: rider)
 * 3. Admin Panel (page: admin)
 *
 * Real-Time Broadcasting: BroadcastChannel('bhusawal_realtime_sync')
 */

(function(root, factory) {
  var backendInstance = factory(root);
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = backendInstance;
  }
  if (typeof root !== 'undefined') {
    root.BhusawalBackend = backendInstance;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BhusawalBackend = backendInstance;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function(root) {
  'use strict';

  var rootScope = root || (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

  // Shared Central Database Storage Keys
  var DB_KEYS = {
    ORDERS: 'bhusawal_orders',
    CUSTOMERS: 'bhusawal_customers_pool',
    RIDERS: 'bhusawal_riders_pool',
    MERCHANTS: 'bhusawal_merchants_pool',
    NOTIFICATIONS: 'bhusawal_sent_notifications_history',
    ADMIN_NOTIF: 'bhusawal_admin_notifications',
    SETTINGS: 'bhusawal_admin_settings',
    RIDER_AUTH: 'bhusawal_rider_auth',
    ADMIN_AUTH: 'bhusawal_admin_auth',
    CATALOG_OVERRIDES: 'bhusawal_catalog_overrides'
  };

  // Setup Real-Time Broadcast Channel
  var channel = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('bhusawal_realtime_sync');
    }
  } catch(e) {}

  var eventListeners = {};

  function emitRealTimeEvent(type, payload) {
    var eventData = { type: type, payload: payload, timestamp: Date.now() };
    
    // Broadcast across browser contexts / tabs
    if (channel) {
      try { channel.postMessage(eventData); } catch(e) {}
    }

    // Trigger local listeners in current window
    if (eventListeners[type]) {
      eventListeners[type].forEach(function(cb) {
        try { cb(payload); } catch(e) {}
      });
    }
  }

  // Storage fallback for cross-tab sync if BroadcastChannel unavailable
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('storage', function(e) {
      if (e.key === DB_KEYS.ORDERS) {
        emitRealTimeEvent('ORDERS_SYNCED', BhusawalBackend.orders.getAll());
      } else if (e.key === DB_KEYS.RIDERS) {
        emitRealTimeEvent('RIDERS_SYNCED', BhusawalBackend.riders.getAll());
      } else if (e.key === DB_KEYS.NOTIFICATIONS) {
        emitRealTimeEvent('NOTIFICATIONS_SYNCED', BhusawalBackend.notifications.getAll());
      }
    });
  }

  if (channel) {
    channel.onmessage = function(e) {
      if (e.data && e.data.type && eventListeners[e.data.type]) {
        eventListeners[e.data.type].forEach(function(cb) {
          try { cb(e.data.payload); } catch(err) {}
        });
      }
    };
  }

  // Universal Helper for JSON LocalStorage with in-memory fallback
  var memoryDb = {};

  function readCollection(key, defaultVal) {
    try {
      if (typeof localStorage !== 'undefined') {
        var data = localStorage.getItem(key);
        if (data) return JSON.parse(data);
      }
    } catch(e) {}
    if (memoryDb[key]) return JSON.parse(JSON.stringify(memoryDb[key]));
    return defaultVal !== undefined ? defaultVal : [];
  }

  function writeCollection(key, data) {
    memoryDb[key] = JSON.parse(JSON.stringify(data));
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch(e) {}
  }

  // Singleton Engine Construction
  var BhusawalBackend = {
    version: '2.7.0-customer-analytics-ready',

    // Access Master Relational Database Engine
    db: function() {
      return rootScope.BhusawalMasterDB;
    },

    // Subscribe to real-time events
    subscribe: function(eventType, callback) {
      if (!eventListeners[eventType]) eventListeners[eventType] = [];
      eventListeners[eventType].push(callback);
    },

    // 1. ORDERS CONTROLLER
    orders: {
      getAll: function() {
        return readCollection(DB_KEYS.ORDERS, []);
      },

      getById: function(id) {
        var orders = this.getAll();
        return orders.find(function(o) { return o.id === id; });
      },

      getByUidOrPhone: function(uid, phone) {
        var orders = this.getAll();
        return orders.filter(function(o) {
          if (uid && o.uid === uid) return true;
          if (uid && o.customerId === uid) return true;
          if (phone && (o.customerPhone === phone || o.phone === phone)) return true;
          return false;
        });
      },

      create: function(orderData) {
        var orders = this.getAll();
        orderData.id = orderData.id || ('ORD-' + Math.floor(100000 + Math.random() * 900000));
        orderData.createdAt = orderData.createdAt || new Date().toISOString();
        orderData.status = orderData.status || 'placed';

        orders.unshift(orderData);
        writeCollection(DB_KEYS.ORDERS, orders);

        // Sync into Master Relational DB tbl_orders
        if (rootScope.BhusawalMasterDB) {
          rootScope.BhusawalMasterDB.insertRecord('tbl_orders', orderData, 'ORD');
        }

        // Recalculate customer behavior metrics
        if (orderData.uid || orderData.customerPhone) {
          BhusawalBackend.customers.recalculateCustomerAnalytics(orderData.uid, orderData.customerPhone);
        }

        emitRealTimeEvent('ORDER_CREATED', orderData);
        emitRealTimeEvent('ORDERS_SYNCED', orders);

        // Unified Notification System: Order Placed
        if (rootScope.BhusawalUnifiedNotificationSystem) {
          rootScope.BhusawalUnifiedNotificationSystem.send({ targetRole: 'customer', type: 'order', title: 'Order Placed', message: 'Your order ' + orderData.id + ' has been placed successfully!', link: '/track_order?id=' + orderData.id });
          rootScope.BhusawalUnifiedNotificationSystem.send({ targetRole: 'admin', type: 'order', title: 'New Order Received', message: 'Order ' + orderData.id + ' from ' + (orderData.customerName || 'Customer') + ' — ₹' + (orderData.total || orderData.amount || '0'), link: '/admin' });
          rootScope.BhusawalUnifiedNotificationSystem.send({ targetRole: 'shop', type: 'order', title: 'New Order Alert', message: 'Prepare order ' + orderData.id + ' — ' + (orderData.items ? orderData.items.length + ' items' : ''), link: '/admin' });
        }

        return orderData;
      },

      updateStatus: function(orderId, status, extraData) {
        var orders = this.getAll();
        var idx = orders.findIndex(function(o) { return o.id === orderId; });
        if (idx >= 0) {
          orders[idx].status = status;
          orders[idx].updatedAt = new Date().toISOString();
          if (extraData) {
            Object.keys(extraData).forEach(function(k) {
              orders[idx][k] = extraData[k];
            });
          }
          writeCollection(DB_KEYS.ORDERS, orders);

          if (rootScope.BhusawalMasterDB) {
            rootScope.BhusawalMasterDB.updateRecord('tbl_orders', orderId, { status: status });
          }

          // Recalculate analytics on status update
          if (orders[idx].uid || orders[idx].customerPhone) {
            BhusawalBackend.customers.recalculateCustomerAnalytics(orders[idx].uid, orders[idx].customerPhone);
          }

          emitRealTimeEvent('ORDER_UPDATED', orders[idx]);
          emitRealTimeEvent('ORDERS_SYNCED', orders);
          return orders[idx];
        }
        return null;
      },

      assignRider: function(orderId, riderId, riderName, riderPhone) {
        var order = this.getById(orderId);
        if (!order) return { success: false, error: 'Order not found' };

        // RACE CONDITION / DUPLICATE ASSIGNMENT GUARD (SCENARIO 15):
        if (order.riderId && order.riderId !== riderId) {
          console.warn('⚠️ Race condition blocked: Order #' + orderId + ' already assigned to Rider ' + order.riderId);
          return { success: false, error: 'Order already accepted by another partner', raceConditionBlocked: true, assignedRiderId: order.riderId };
        }

        // SERVER-SIDE DISPATCH GUARD: Passenger exclusivity & multi-order capacity
        var engine = (typeof BslFleetEngine !== 'undefined' ? BslFleetEngine : (root && root.BslFleetEngine ? root.BslFleetEngine : (typeof globalThis !== 'undefined' && globalThis.BslFleetEngine ? globalThis.BslFleetEngine : null)));
        if (engine) {
          var rider = BhusawalBackend.riders.getById(riderId);
          if (rider) {
            var check = engine.canReceiveOrder(rider, order);
            if (!check.canReceive) {
              console.warn('⚠️ Server-Side Dispatch Guard Blocked Assignment:', check.reason);
              return { success: false, error: check.reason, blocked: true };
            }
          }
        }

        // Attach order to rider's active orders & update state
        var riderObj = BhusawalBackend.riders.getById(riderId);
        if (riderObj) {
          if (!Array.isArray(riderObj.activeOrders)) riderObj.activeOrders = [];
          var exists = riderObj.activeOrders.some(function(o) { return o.id === orderId; });
          if (!exists) {
            riderObj.activeOrders.push(order);
          }
          riderObj.activeOrderId = orderId;
          riderObj.activeOrdersCount = riderObj.activeOrders.length;

          var isPax = engine ? engine.isPassengerOrder(order) : (order.type === 'PASSENGER');
          if (isPax) {
            riderObj.state = 'PASSENGER_PICKUP';
            riderObj.isPassengerLocked = true;
          } else {
            riderObj.state = riderObj.activeOrders.length > 1 ? 'MULTI_ORDER' : 'GOING_TO_PICKUP';
          }
          BhusawalBackend.riders.save(riderObj);
        }

        return this.updateStatus(orderId, 'partner_accepted', {
          riderId: riderId,
          riderName: riderName,
          riderPhone: riderPhone,
          assignedAt: new Date().toISOString()
        });
      },

      rejectOrder: function(orderId, riderId, reason) {
        var order = this.getById(orderId);
        if (!order) return { success: false, error: 'Order not found' };
        if (!Array.isArray(order.rejectedBy)) order.rejectedBy = [];
        if (order.rejectedBy.indexOf(riderId) < 0) {
          order.rejectedBy.push(riderId);
        }
        order.lastRejectedAt = new Date().toISOString();
        var updated = this.updateStatus(orderId, order.status || 'placed', {
          rejectedBy: order.rejectedBy,
          lastRejectedReason: reason || 'Rider declined offer'
        });
        emitRealTimeEvent('ORDER_REJECTED_BY_RIDER', { orderId: orderId, riderId: riderId, reason: reason });
        return { success: true, orderId: orderId, rejectedBy: order.rejectedBy, order: updated };
      },

      cancelByRider: function(orderId, riderId, reason) {
        var order = this.getById(orderId);
        if (!order) return { success: false, error: 'Order not found' };

        var updated = this.updateStatus(orderId, 'escalated_reassign', {
          riderId: null,
          riderName: null,
          riderPhone: null,
          previousRiderId: riderId,
          cancellationReason: reason || 'Rider cancelled active delivery',
          cancelledByRiderAt: new Date().toISOString()
        });

        var rider = BhusawalBackend.riders.getById(riderId);
        if (rider) {
          if (Array.isArray(rider.activeOrders)) {
            rider.activeOrders = rider.activeOrders.filter(function(o) { return o.id !== orderId; });
          }
          if (rider.activeOrderId === orderId) rider.activeOrderId = null;
          rider.activeOrdersCount = Array.isArray(rider.activeOrders) ? rider.activeOrders.length : 0;
          if (rider.activeOrdersCount === 0 && rider.state !== 'OFFLINE' && rider.state !== 'SUSPENDED') {
            BhusawalBackend.riders.transitionState(rider, 'AVAILABLE');
          } else {
            BhusawalBackend.riders.save(rider);
          }
        }

        emitRealTimeEvent('ORDER_ESCALATED_REASSIGN', { orderId: orderId, previousRiderId: riderId, reason: reason });
        return { success: true, orderId: orderId, status: 'escalated_reassign', order: updated };
      },

      cancelByCustomer: function(orderId, reason) {
        var order = this.getById(orderId);
        if (!order) return { success: false, error: 'Order not found' };

        var assignedRiderId = order.riderId;

        var updated = this.updateStatus(orderId, 'cancelled', {
          cancelledBy: 'customer',
          cancelReason: reason || 'Customer cancelled order',
          cancelledAt: new Date().toISOString()
        });

        if (assignedRiderId) {
          var rider = BhusawalBackend.riders.getById(assignedRiderId);
          if (rider) {
            if (Array.isArray(rider.activeOrders)) {
              rider.activeOrders = rider.activeOrders.filter(function(o) { return o.id !== orderId; });
            }
            if (rider.activeOrderId === orderId) rider.activeOrderId = null;
            rider.activeOrdersCount = Array.isArray(rider.activeOrders) ? rider.activeOrders.length : 0;
            if (rider.activeOrdersCount === 0 && rider.state !== 'OFFLINE' && rider.state !== 'SUSPENDED') {
              BhusawalBackend.riders.transitionState(rider, 'AVAILABLE');
            } else {
              BhusawalBackend.riders.save(rider);
            }
          }

          if (root && root.BhusawalUnifiedNotificationSystem) {
            root.BhusawalUnifiedNotificationSystem.send({
              targetRole: 'rider',
              riderId: assignedRiderId,
              type: 'order_cancelled',
              title: 'Order Cancelled',
              message: 'Customer cancelled order #' + orderId + (reason ? ' (' + reason + ')' : '')
            });
          }
        }

        emitRealTimeEvent('ORDER_CANCELLED_BY_CUSTOMER', { orderId: orderId, reason: reason });
        return { success: true, orderId: orderId, status: 'cancelled', order: updated };
      },

      collectCodPayment: function(orderId, amountCollected, riderId) {
        var order = this.getById(orderId);
        if (!order) return { success: false, error: 'Order not found' };

        var amount = Number(amountCollected !== undefined ? amountCollected : (order.total || order.amount || 0));

        var updatedOrder = this.updateStatus(orderId, 'delivered', {
          paymentStatus: 'PAID',
          paymentMethod: 'COD',
          codCollected: true,
          codAmount: amount,
          codCollectedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        });

        if (riderId) {
          var rider = BhusawalBackend.riders.getById(riderId);
          if (rider) {
            rider.cashInHand = (rider.cashInHand || 0) + amount;
            if (Array.isArray(rider.activeOrders)) {
              rider.activeOrders = rider.activeOrders.filter(function(o) { return o.id !== orderId; });
            }
            if (rider.activeOrderId === orderId) rider.activeOrderId = null;
            rider.activeOrdersCount = Array.isArray(rider.activeOrders) ? rider.activeOrders.length : 0;
            if (rider.activeOrdersCount === 0 && rider.state !== 'OFFLINE') {
              BhusawalBackend.riders.transitionState(rider, 'AVAILABLE');
            } else {
              BhusawalBackend.riders.save(rider);
            }
          }
        }

        emitRealTimeEvent('COD_PAYMENT_COLLECTED', { orderId: orderId, amount: amount, riderId: riderId });
        return { success: true, order: updatedOrder, amountCollected: amount };
      }
    },

    // 2. RIDERS CONTROLLER
    riders: {
      getAll: function() {
        return readCollection(DB_KEYS.RIDERS, []);
      },

      getById: function(id) {
        var riders = this.getAll();
        return riders.find(function(r) { return r.id === id; });
      },

      save: function(riderData) {
        var riders = this.getAll();
        var idx = riders.findIndex(function(r) { return r.id === riderData.id || r.phone === riderData.phone; });
        if (idx >= 0) {
          riders[idx] = Object.assign(riders[idx], riderData);
        } else {
          riders.push(riderData);
        }
        writeCollection(DB_KEYS.RIDERS, riders);

        if (rootScope.BhusawalMasterDB) {
          rootScope.BhusawalMasterDB.insertRecord('tbl_delivery_partners', riderData, 'RIDER');
        }

        emitRealTimeEvent('RIDER_UPDATED', riderData);
        emitRealTimeEvent('RIDERS_SYNCED', riders);
        return riderData;
      },

      transitionState: function(riderOrId, targetState, context) {
        var rider = (typeof riderOrId === 'object' && riderOrId !== null) ? riderOrId : this.getById(riderOrId);
        if (!rider) return { success: false, error: 'Rider not found' };
        if (rootScope.BslFleetEngine) {
          var res = rootScope.BslFleetEngine.transitionRiderState(rider, targetState, context);
          if (res.success) {
            this.save(rider);
          }
          return res;
        }
        rider.state = targetState;
        this.save(rider);
        return { success: true, currentState: targetState };
      },

      canReceiveOrder: function(riderId, order) {
        var rider = this.getById(riderId);
        if (!rider) return { canReceive: false, reason: 'Rider not found' };
        if (rootScope.BslFleetEngine) {
          return rootScope.BslFleetEngine.canReceiveOrder(rider, order);
        }
        return { canReceive: rider.isOnline === true, reason: 'Legacy fallback check' };
      },

      canAcceptOrder: function(riderId, order) {
        var rider = this.getById(riderId);
        if (!rider) return { canAccept: false, reason: 'Rider not found' };
        if (rootScope.BslFleetEngine) {
          return rootScope.BslFleetEngine.canAcceptOrder(rider, order);
        }
        return { canAccept: rider.isOnline === true, reason: 'Legacy fallback check' };
      },

      fleetEngine: function() {
        return rootScope.BslFleetEngine || null;
      }
    },

    // 3. CUSTOMERS CONTROLLER (WITH PRIVACY-CONSCIOUS BEHAVIOR ANALYTICS)
    customers: {
      getAll: function() {
        return readCollection(DB_KEYS.CUSTOMERS, []);
      },

      getByUidOrPhone: function(uid, phone) {
        var customers = this.getAll();
        return customers.find(function(c) {
          if (uid && c.uid === uid) return true;
          if (phone && (c.phone === phone || c.phoneNumber === phone)) return true;
          return false;
        });
      },

      getById: function(id) {
        var customers = this.getAll();
        return customers.find(function(c) { return c.id === id || c.customerId === id || c.uid === id; });
      },

      recalculateCustomerAnalytics: function(uid, phone) {
        var customer = this.getByUidOrPhone(uid, phone);
        if (!customer) return null;

        var orders = BhusawalBackend.orders.getByUidOrPhone(customer.uid, customer.phoneNumber);
        
        var completedOrders = orders.filter(function(o) {
          var s = (o.status || '').toLowerCase();
          return s === 'delivered' || s === 'confirmed' || s === 'placed';
        });

        var cancelledOrders = orders.filter(function(o) {
          var s = (o.status || '').toLowerCase();
          return s === 'cancelled';
        });

        var totalSpend = completedOrders.reduce(function(acc, o) {
          return acc + parseFloat(o.total || o.amount || 0);
        }, 0);

        var categoryCounts = {};
        var productCounts = {};

        completedOrders.forEach(function(o) {
          if (o.items && Array.isArray(o.items)) {
            o.items.forEach(function(i) {
              var cat = i.category || i.cat || 'Daily Needs';
              var name = i.displayName || i.name || i.originalName || 'Product';
              var qty = i.quantity || 1;

              categoryCounts[cat] = (categoryCounts[cat] || 0) + qty;
              productCounts[name] = (productCounts[name] || 0) + qty;
            });
          }
        });

        var favoriteCategories = Object.keys(categoryCounts).sort(function(a, b) {
          return categoryCounts[b] - categoryCounts[a];
        }).slice(0, 3);

        var favoriteProducts = Object.keys(productCounts).sort(function(a, b) {
          return productCounts[b] - productCounts[a];
        }).slice(0, 3);

        customer.totalOrders = orders.length;
        customer.totalCompletedOrders = completedOrders.length;
        customer.totalCancelledOrders = cancelledOrders.length;
        customer.totalSpend = Math.round(totalSpend);
        customer.averageOrderValue = completedOrders.length > 0 ? Math.round(totalSpend / completedOrders.length) : 0;
        customer.lastOrderAt = orders.length > 0 ? (orders[0].createdAt || orders[0].date) : null;
        customer.favoriteCategories = favoriteCategories.length > 0 ? favoriteCategories : ['Daily Needs'];
        customer.favoriteProducts = favoriteProducts.length > 0 ? favoriteProducts : [];
        customer.updatedAt = new Date().toISOString();

        return this.save(customer);
      },

      save: function(custData) {
        var customers = this.getAll();
        // Deduplication Matcher: Match by UID first, then by Phone Number
        var idx = customers.findIndex(function(c) {
          if (custData.uid && c.uid === custData.uid) return true;
          if (custData.phoneNumber && (c.phone === custData.phoneNumber || c.phoneNumber === custData.phoneNumber)) return true;
          if (custData.phone && (c.phone === custData.phone || c.phoneNumber === custData.phone)) return true;
          return false;
        });

        var now = new Date().toISOString();

        if (idx >= 0) {
          customers[idx] = Object.assign({}, customers[idx], custData, {
            uid: custData.uid || customers[idx].uid,
            updatedAt: now,
            lastLoginAt: custData.lastLoginAt || customers[idx].lastLoginAt || now
          });
          custData = customers[idx];
        } else {
          // Create new customer profile with full analytics & privacy consent schema
          custData.customerId = custData.customerId || ('CUST-' + (custData.uid ? custData.uid.substring(0, 8).toUpperCase() : Math.floor(1000 + Math.random() * 9000)));
          custData.uid = custData.uid || custData.customerId;
          custData.phoneNumber = custData.phoneNumber || custData.phone || '';
          custData.phone = custData.phoneNumber;
          custData.name = custData.name || 'Bhusawal Customer';
          custData.email = custData.email || '';
          custData.preferredArea = custData.preferredArea || 'Bhusawal City';
          custData.savedAddresses = custData.savedAddresses || [];
          custData.createdAt = custData.createdAt || now;
          custData.lastLoginAt = now;
          custData.lastOrderAt = custData.lastOrderAt || null;
          custData.totalOrders = custData.totalOrders || 0;
          custData.totalCompletedOrders = custData.totalCompletedOrders || 0;
          custData.totalCancelledOrders = custData.totalCancelledOrders || 0;
          custData.totalSpend = custData.totalSpend || 0;
          custData.averageOrderValue = custData.averageOrderValue || 0;
          custData.favoriteCategories = custData.favoriteCategories || ['Daily Needs'];
          custData.favoriteProducts = custData.favoriteProducts || [];
          custData.marketingConsent = custData.marketingConsent !== undefined ? custData.marketingConsent : true;
          custData.promotionalSmsConsent = custData.promotionalSmsConsent !== undefined ? custData.promotionalSmsConsent : true;
          custData.accountStatus = custData.accountStatus || 'active';

          customers.push(custData);
        }

        writeCollection(DB_KEYS.CUSTOMERS, customers);

        if (rootScope.BhusawalMasterDB) {
          rootScope.BhusawalMasterDB.insertRecord('tbl_customers', custData, 'CUST');
        }

        emitRealTimeEvent('CUSTOMERS_SYNCED', customers);
        return custData;
      }
    },

    // 4. MERCHANTS CONTROLLER
    merchants: {
      getAll: function() {
        return readCollection(DB_KEYS.MERCHANTS, []);
      },

      getById: function(id) {
        var merchants = this.getAll();
        return merchants.find(function(m) { return m.id === id; });
      },

      save: function(merchantData) {
        var merchants = this.getAll();
        var idx = merchants.findIndex(function(m) { return m.id === merchantData.id; });
        if (idx >= 0) {
          merchants[idx] = Object.assign(merchants[idx], merchantData);
        } else {
          merchants.push(merchantData);
        }
        writeCollection(DB_KEYS.MERCHANTS, merchants);

        if (rootScope.BhusawalMasterDB) {
          if (merchantData.category === 'Grocery') rootScope.BhusawalMasterDB.insertRecord('tbl_partner_shops', merchantData, 'SHOP');
          else if (merchantData.category === 'Restaurant') rootScope.BhusawalMasterDB.insertRecord('tbl_restaurants', merchantData, 'REST');
          else if (merchantData.category === 'Medical') rootScope.BhusawalMasterDB.insertRecord('tbl_medical_stores', merchantData, 'MED');
        }

        emitRealTimeEvent('MERCHANTS_SYNCED', merchants);
        return merchantData;
      }
    },

    // 5. NOTIFICATIONS CONTROLLER (SEPARATES TRANSACTIONAL FROM PROMOTIONAL SMS)
    notifications: {
      getAll: function() {
        return readCollection(DB_KEYS.NOTIFICATIONS, []);
      },

      broadcast: function(notif) {
        // Enforce promotional SMS privacy consent check
        if (notif.type === 'promotional' || notif.isPromotional === true) {
          var cust = BhusawalBackend.customers.getByUidOrPhone(notif.uid, notif.customerPhone);
          if (cust && cust.promotionalSmsConsent === false) {
            console.warn('[Privacy Protection] Promotional SMS blocked for customer (Opted Out):', cust.phoneNumber);
            return null;
          }
        }

        var notifs = this.getAll();
        notif.id = notif.id || ('NOTIF-' + Math.floor(1000 + Math.random() * 9000));
        notif.time = 'Just now';
        notifs.unshift(notif);
        writeCollection(DB_KEYS.NOTIFICATIONS, notifs);

        if (rootScope.BhusawalMasterDB) {
          rootScope.BhusawalMasterDB.insertRecord('tbl_notifications', notif, 'NOTIF');
        }

        emitRealTimeEvent('NOTIFICATION_SENT', notif);
        emitRealTimeEvent('NOTIFICATIONS_SYNCED', notifs);
        return notif;
      }
    },

    // 6. SETTINGS CONTROLLER
    settings: {
      get: function() {
        return readCollection(DB_KEYS.SETTINGS, {});
      },

      save: function(data) {
        writeCollection(DB_KEYS.SETTINGS, data);

        if (rootScope.BhusawalMasterDB) {
          rootScope.BhusawalMasterDB.insertRecord('tbl_settings', data, 'SETT');
        }

        emitRealTimeEvent('SETTINGS_UPDATED', data);
        return data;
      }
    }
  };

  // Return Singleton from factory
  return BhusawalBackend;
});

