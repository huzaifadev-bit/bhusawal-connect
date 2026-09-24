/**
 * Bhusawal Connect - Standard 10-Stage Delivery Workflow Engine
 * Tri-App Realtime Synchronization: Customer App <-> Delivery Partner App <-> Admin Console
 */
window.BhusawalDeliveryWorkflow = (function() {
  
  // 10 Standard Sequential Delivery Workflow Stages
  var STAGES = {
    1: { step: 1, id: 'ORDER_ASSIGNED', label: 'Order Assigned', icon: 'assignment', actionBtnText: 'Accept Order', desc: 'Nearest partner assigned by Smart Dispatch' },
    2: { step: 2, id: 'PARTNER_ACCEPTED', label: 'Partner Accepted', icon: 'check_circle', actionBtnText: 'Start Route to Pickup', desc: 'Delivery partner accepted order request' },
    3: { step: 3, id: 'NAVIGATE_TO_PICKUP', label: 'Navigate to Pickup', icon: 'directions_bike', actionBtnText: 'Reached Pickup Store', desc: 'Partner driving to store/pickup location' },
    4: { step: 4, id: 'REACHED_PICKUP', label: 'Reached Pickup', icon: 'storefront', actionBtnText: 'Confirm Pickup & Package Received', desc: 'Partner arrived at pickup location' },
    5: { step: 5, id: 'PICKUP_CONFIRMED', label: 'Pickup Confirmed', icon: 'inventory', actionBtnText: 'Start Route to Customer', desc: 'Package collected & verified by partner' },
    6: { step: 6, id: 'NAVIGATE_TO_CUSTOMER', label: 'Navigate to Customer', icon: 'local_shipping', actionBtnText: 'Reached Customer Destination', desc: 'Partner driving to customer delivery address' },
    7: { step: 7, id: 'REACHED_DESTINATION', label: 'Reached Destination', icon: 'near_me', actionBtnText: 'Verify 4-Digit Customer OTP', desc: 'Partner arrived at customer doorstep' },
    8: { step: 8, id: 'OTP_VERIFICATION', label: 'OTP Verification', icon: 'pin', actionBtnText: 'Complete Delivery & Collect Payment', desc: 'Awaiting 4-digit handover OTP from customer' },
    9: { step: 9, id: 'DELIVERED', label: 'Delivered', icon: 'verified', actionBtnText: 'Payment Received', desc: 'Package handed over safely & verified' },
    10: { step: 10, id: 'PAYMENT_COMPLETED', label: 'Payment Completed', icon: 'payments', actionBtnText: 'Ready for Next Order 🚀', desc: 'Earnings credited to partner wallet. Ready for next order.' }
  };

  // Move order to next stage in state machine & sync across Customer, Admin, and Rider apps
  function advanceDeliveryStage(orderId, nextStageStep) {
    try {
      var orders = JSON.parse(localStorage.getItem('bhusawal_orders') || '[]');
      var activeOrder = JSON.parse(localStorage.getItem('bhusawal_active_order') || 'null');
      
      var targetStage = STAGES[nextStageStep] || STAGES[9];

      orders.forEach(function(o) {
        if (o.id === orderId || o.orderId === orderId) {
          o.stageStep = nextStageStep;
          o.stageId = targetStage.id;
          o.stageLabel = targetStage.label;
          o.status = targetStage.label;
          o.lastUpdated = new Date().toISOString();

          if (nextStageStep >= 9) {
            o.status = 'Delivered';
            o.completedAt = new Date().toISOString();
          }
        }
      });

      if (activeOrder && (activeOrder.id === orderId || activeOrder.orderId === orderId)) {
        activeOrder.stageStep = nextStageStep;
        activeOrder.stageId = targetStage.id;
        activeOrder.stageLabel = targetStage.label;
        activeOrder.status = targetStage.label;
        activeOrder.lastUpdated = new Date().toISOString();

        if (nextStageStep >= 9) {
          activeOrder.status = 'Delivered';
          activeOrder.completedAt = new Date().toISOString();
        }
        localStorage.setItem('bhusawal_active_order', JSON.stringify(activeOrder));
      }

      localStorage.setItem('bhusawal_orders', JSON.stringify(orders));

      // Emit real-time sync events across all active windows
      window.dispatchEvent(new Event('deliveryStageChanged'));
      window.dispatchEvent(new Event('orderUpdated'));
      window.dispatchEvent(new Event('storage'));

      return { success: true, stage: targetStage };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  function getStageInfo(stepNum) {
    return STAGES[stepNum] || STAGES[1];
  }

  return {
    STAGES: STAGES,
    advanceDeliveryStage: advanceDeliveryStage,
    getStageInfo: getStageInfo
  };

})();
