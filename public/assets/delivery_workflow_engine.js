/**
 * Bhusawal Connect - Standard 10-Stage Delivery Workflow Engine
 * Tri-App Realtime Synchronization: Customer App <-> Delivery Partner App <-> Admin Console
 */
window.BhusawalDeliveryWorkflow = (function() {
  
  // 10 Standard Sequential Delivery Workflow Stages
  var DELIVERY_STAGES = {
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

  // 10 Standard Sequential Passenger Ride Stages
  var PASSENGER_STAGES = {
    1: { step: 1, id: 'RIDE_ASSIGNED', label: 'Ride Assigned', icon: 'assignment', actionBtnText: 'Accept Ride', desc: 'Passenger ride request assigned to nearest rider' },
    2: { step: 2, id: 'RIDER_ACCEPTED', label: 'Ride Accepted', icon: 'check_circle', actionBtnText: 'Navigate to Passenger', desc: 'Rider accepted ride. Proceeding to passenger pickup.' },
    3: { step: 3, id: 'NAVIGATE_TO_PASSENGER', label: 'Driving to Passenger', icon: 'directions_bike', actionBtnText: 'Reached Passenger Location', desc: 'Rider en-route to passenger location' },
    4: { step: 4, id: 'REACHED_PASSENGER', label: 'Reached Passenger', icon: 'person_pin_circle', actionBtnText: 'Verify 4-Digit Boarding OTP', desc: 'Arrived at passenger pickup. Verify OTP before starting bike.' },
    5: { step: 5, id: 'BOARDING_OTP_VERIFIED', label: 'Passenger Boarded', icon: 'two_wheeler', actionBtnText: 'Start Ride to Destination', desc: 'OTP verified. Passenger wearing helmet. Ready to start trip.' },
    6: { step: 6, id: 'TRIP_IN_PROGRESS', label: 'Trip in Progress', icon: 'navigation', actionBtnText: 'Reached Destination', desc: 'Driving passenger to drop location' },
    7: { step: 7, id: 'REACHED_DROP', label: 'Reached Destination', icon: 'near_me', actionBtnText: 'Collect Ride Fare', desc: 'Arrived at passenger destination safely' },
    8: { step: 8, id: 'COLLECT_FARE', label: 'Collect Fare', icon: 'payments', actionBtnText: 'Confirm Payment Received', desc: 'Awaiting cash or UPI payment from passenger' },
    9: { step: 9, id: 'PASSENGER_COMPLETED', label: 'Ride Completed', icon: 'verified', actionBtnText: 'Complete Trip', desc: 'Passenger ride finished safely' },
    10: { step: 10, id: 'PAYMENT_COMPLETED', label: 'Payment Settled', icon: 'payments', actionBtnText: 'Ready for Next Ride / Order 🚀', desc: 'Fare credited to partner wallet. Ready for new requests.' }
  };

  var STAGES = DELIVERY_STAGES;

  function isPassengerOrder(order) {
    if (!order) return false;
    if (window.BslFleetEngine) return window.BslFleetEngine.isPassengerOrder(order);
    var t = (order.type || order.category || order.serviceType || '').toUpperCase();
    return t === 'PASSENGER' || t === 'BIKE_RIDE' || t === 'BIKETAXI';
  }

  // Move order to next stage in state machine & sync across Customer, Admin, and Rider apps
  function advanceDeliveryStage(orderId, nextStageStep) {
    try {
      var orders = JSON.parse(localStorage.getItem('bhusawal_orders') || '[]');
      var activeOrder = JSON.parse(localStorage.getItem('bhusawal_active_order') || 'null');
      
      var isPassenger = false;
      var matchingOrder = orders.find(function(o) { return o.id === orderId || o.orderId === orderId; }) || activeOrder;
      if (matchingOrder) {
        isPassenger = isPassengerOrder(matchingOrder);
      }

      var stageCatalog = isPassenger ? PASSENGER_STAGES : DELIVERY_STAGES;
      var targetStage = stageCatalog[nextStageStep] || stageCatalog[9];

      orders.forEach(function(o) {
        if (o.id === orderId || o.orderId === orderId) {
          o.stageStep = nextStageStep;
          o.stageId = targetStage.id;
          o.stageLabel = targetStage.label;
          o.status = targetStage.label;
          o.lastUpdated = new Date().toISOString();

          if (nextStageStep >= 9) {
            o.status = isPassenger ? 'Completed' : 'Delivered';
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
          activeOrder.status = isPassenger ? 'Completed' : 'Delivered';
          activeOrder.completedAt = new Date().toISOString();
        }
        localStorage.setItem('bhusawal_active_order', JSON.stringify(activeOrder));
      }

      localStorage.setItem('bhusawal_orders', JSON.stringify(orders));

      // Synchronize with BslFleetEngine rider state machine
      if (window.BslFleetEngine) {
        try {
          var authRider = JSON.parse(localStorage.getItem('bhusawal_rider_auth') || 'null');
          if (authRider) {
            var targetRiderState = null;
            if (isPassenger) {
              if (nextStageStep >= 2 && nextStageStep <= 4) targetRiderState = window.BslFleetEngine.RIDER_STATES.PASSENGER_PICKUP;
              else if (nextStageStep >= 5 && nextStageStep <= 7) targetRiderState = window.BslFleetEngine.RIDER_STATES.PASSENGER_ACTIVE;
              else if (nextStageStep >= 8 && nextStageStep <= 9) targetRiderState = window.BslFleetEngine.RIDER_STATES.PASSENGER_COMPLETED;
              else if (nextStageStep >= 10) targetRiderState = window.BslFleetEngine.RIDER_STATES.AVAILABLE;
            } else {
              if (nextStageStep === 2 || nextStageStep === 3) targetRiderState = window.BslFleetEngine.RIDER_STATES.GOING_TO_PICKUP;
              else if (nextStageStep === 4) targetRiderState = window.BslFleetEngine.RIDER_STATES.AT_PICKUP;
              else if (nextStageStep === 5) targetRiderState = window.BslFleetEngine.RIDER_STATES.PICKED_UP;
              else if (nextStageStep >= 6 && nextStageStep <= 8) targetRiderState = window.BslFleetEngine.RIDER_STATES.DELIVERING;
              else if (nextStageStep >= 9) targetRiderState = window.BslFleetEngine.RIDER_STATES.AVAILABLE;
            }

            if (targetRiderState) {
              window.BslFleetEngine.transitionRiderState(authRider, targetRiderState, {
                order: matchingOrder,
                clearOrders: nextStageStep >= 10
              });
            }
          }
        } catch(err) {}
      }

      // Emit real-time sync events across all active windows
      window.dispatchEvent(new Event('deliveryStageChanged'));
      window.dispatchEvent(new Event('orderUpdated'));
      window.dispatchEvent(new Event('storage'));

      return { success: true, stage: targetStage, isPassenger: isPassenger };
    } catch(e) {
      return { success: false, error: e.message };
    }
  }

  function getStageInfo(stepNum, orderOrType) {
    var isPassenger = false;
    if (orderOrType) {
      if (typeof orderOrType === 'object') isPassenger = isPassengerOrder(orderOrType);
      else isPassenger = (orderOrType.toUpperCase() === 'PASSENGER' || orderOrType.toUpperCase() === 'BIKE_RIDE');
    }
    var catalog = isPassenger ? PASSENGER_STAGES : DELIVERY_STAGES;
    return catalog[stepNum] || catalog[1];
  }

  return {
    STAGES: DELIVERY_STAGES,
    DELIVERY_STAGES: DELIVERY_STAGES,
    PASSENGER_STAGES: PASSENGER_STAGES,
    advanceDeliveryStage: advanceDeliveryStage,
    getStageInfo: getStageInfo
  };

})();
