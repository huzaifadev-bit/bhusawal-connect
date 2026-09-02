// Bhusawal Connect - Delivery Workflow & Real-time State Machine Engine
(function(window) {
  'use strict';

  const DeliveryWorkflow = {
    ORDER_STATUSES: {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      ASSIGNED: 'assigned',
      RIDER_ACCEPTED: 'rider_accepted',
      ARRIVED_STORE: 'arrived_store',
      PICKED_UP: 'picked_up',
      OUT_FOR_DELIVERY: 'out_for_delivery',
      ARRIVED_CUSTOMER: 'arrived_customer',
      DELIVERED: 'delivered',
      CANCELLED: 'cancelled'
    },

    TRANSITIONS: {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['assigned', 'cancelled'],
      'assigned': ['rider_accepted', 'assigned', 'cancelled'],
      'rider_accepted': ['arrived_store', 'cancelled'],
      'arrived_store': ['picked_up', 'cancelled'],
      'picked_up': ['out_for_delivery'],
      'out_for_delivery': ['arrived_customer'],
      'arrived_customer': ['delivered']
    },

    canTransition(fromStatus, toStatus) {
      const allowed = this.TRANSITIONS[fromStatus];
      return allowed && allowed.includes(toStatus);
    },

    updateOrderStatus(orderId, newStatus, extraData = {}) {
      if (!window.BHUSAWAL_BACKEND || !window.BHUSAWAL_BACKEND.orders) return false;
      const orders = window.BHUSAWAL_BACKEND.orders.getAll();
      const order = orders.find(o => o.id === orderId);
      if (!order) return false;

      order.status = newStatus;
      order.updatedAt = new Date().toISOString();
      Object.assign(order, extraData);

      if (!order.timeline) order.timeline = [];
      order.timeline.push({
        status: newStatus,
        timestamp: new Date().toISOString(),
        note: extraData.note || `Order status updated to ${newStatus}`
      });

      localStorage.setItem('bhusawal_orders', JSON.stringify(orders));

      // Broadcast update event
      window.dispatchEvent(new CustomEvent('bhusawal:order_updated', {
        detail: { orderId, status: newStatus, order }
      }));

      return true;
    }
  };

  window.BHUSAWAL_WORKFLOW = DeliveryWorkflow;
})(window);
