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

(function(window) {
  'use strict';

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
  window.addEventListener('storage', function(e) {
    if (e.key === DB_KEYS.ORDERS) {
      emitRealTimeEvent('ORDERS_SYNCED', BhusawalBackend.orders.getAll());
    } else if (e.key === DB_KEYS.RIDERS) {
      emitRealTimeEvent('RIDERS_SYNCED', BhusawalBackend.riders.getAll());
    } else if (e.key === DB_KEYS.NOTIFICATIONS) {
      emitRealTimeEvent('NOTIFICATIONS_SYNCED', BhusawalBackend.notifications.getAll());
    }
  });

  if (channel) {
    channel.onmessage = function(e) {
      if (e.data && e.data.type && eventListeners[e.data.type]) {
        eventListeners[e.data.type].forEach(function(cb) {
          try { cb(e.data.payload); } catch(err) {}
        });
      }
    };
  }

  // Universal Helper for JSON LocalStorage
  function readCollection(key, defaultVal) {
    try {
      var data = localStorage.getItem(key);
      if (data) return JSON.parse(data);
    } catch(e) {}
    return defaultVal || [];
  }

  function writeCollection(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch(e) {}
  }

  // Singleton Engine Construction
  var BhusawalBackend = {
    version: '2.7.0-customer-analytics-ready',

    // Access Master Relational Database Engine
    db: function() {
      return window.BhusawalMasterDB;
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
        if (window.BhusawalMasterDB) {
          window.BhusawalMasterDB.insertRecord('tbl_orders', orderData, 'ORD');
        }

        // Recalculate customer behavior metrics
        if (orderData.uid || orderData.customerPhone) {
          BhusawalBackend.customers.recalculateCustomerAnalytics(orderData.uid, orderData.customerPhone);
        }

        emitRealTimeEvent('ORDER_CREATED', orderData);
        emitRealTimeEvent('ORDERS_SYNCED', orders);

        // Unified Notification System: Order Placed
        if (window.BhusawalUnifiedNotificationSystem) {
          window.BhusawalUnifiedNotificationSystem.send({ targetRole: 'customer', type: 'order', title: 'Order Placed', message: 'Your order ' + orderData.id + ' has been placed successfully!', link: '/track_order?id=' + orderData.id });
          window.BhusawalUnifiedNotificationSystem.send({ targetRole: 'admin', type: 'order', title: 'New Order Received', message: 'Order ' + orderData.id + ' from ' + (orderData.customerName || 'Customer') + ' — ₹' + (orderData.total || orderData.amount || '0'), link: '/admin' });
          window.BhusawalUnifiedNotificationSystem.send({ targetRole: 'shop', type: 'order', title: 'New Order Alert', message: 'Prepare order ' + orderData.id + ' — ' + (orderData.items ? orderData.items.length + ' items' : ''), link: '/admin' });
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

          if (window.BhusawalMasterDB) {
            window.BhusawalMasterDB.updateRecord('tbl_orders', orderId, { status: status });
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
        return this.updateStatus(orderId, 'partner_accepted', {
          riderId: riderId,
          riderName: riderName,
          riderPhone: riderPhone,
          assignedAt: new Date().toISOString()
        });
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

        if (window.BhusawalMasterDB) {
          window.BhusawalMasterDB.insertRecord('tbl_delivery_partners', riderData, 'RIDER');
        }

        emitRealTimeEvent('RIDER_UPDATED', riderData);
        emitRealTimeEvent('RIDERS_SYNCED', riders);
        return riderData;
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

        if (window.BhusawalMasterDB) {
          window.BhusawalMasterDB.insertRecord('tbl_customers', custData, 'CUST');
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

        if (window.BhusawalMasterDB) {
          if (merchantData.category === 'Grocery') window.BhusawalMasterDB.insertRecord('tbl_partner_shops', merchantData, 'SHOP');
          else if (merchantData.category === 'Restaurant') window.BhusawalMasterDB.insertRecord('tbl_restaurants', merchantData, 'REST');
          else if (merchantData.category === 'Medical') window.BhusawalMasterDB.insertRecord('tbl_medical_stores', merchantData, 'MED');
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

        if (window.BhusawalMasterDB) {
          window.BhusawalMasterDB.insertRecord('tbl_notifications', notif, 'NOTIF');
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

        if (window.BhusawalMasterDB) {
          window.BhusawalMasterDB.insertRecord('tbl_settings', data, 'SETT');
        }

        emitRealTimeEvent('SETTINGS_UPDATED', data);
        return data;
      }
    }
  };

  // Expose to window object
  window.BhusawalBackend = BhusawalBackend;

})(window);
