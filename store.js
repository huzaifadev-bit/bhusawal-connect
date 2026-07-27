// Bhusawal Connect State Management and Mock Database

const initialState = {
  // Application portals: 'customer', 'merchant', 'driver'
  activePortal: 'customer',
  
  // Active page inside customer portal: 'home', 'groceries', 'medicines', 'food', 'parcel', 'transport', 'tracking'
  customerPage: 'home',
  
  theme: 'dark', // 'dark' or 'light'
  
  // Shopping Cart
  cart: {
    shopId: null,
    shopName: '',
    items: [], // { id, name, price, quantity }
    subtotal: 0,
    deliveryFee: 40,
    total: 0
  },
  
  // Active Orders (simulating database entries)
  orders: [
    {
      id: "BC-9842",
      customerName: "Sahil Chaudhari",
      shopId: "grocery-hub",
      shopName: "Daily Needs Delivery",
      type: "grocery",
      items: [
        { name: "Premium Lokwan Wheat Flour (5kg)", price: 220, quantity: 1 },
        { name: "Pure Groundnut Oil (1L)", price: 175, quantity: 1 }
      ],
      subtotal: 395,
      deliveryFee: 0,
      total: 395,
      status: "completed", // pending, preparing, in_transit, completed
      timestamp: "2026-07-04 12:30",
      rating: 5,
      deliveryAgent: "Anand Chaudhari"
    }
  ],
  
  // Active Transport Bookings
  bookings: [],
  
  // Driver / Delivery Partner State
  driverState: {
    isOnline: false,
    earnings: 320,
    tripsCompleted: 4,
    currentJob: null, // Holds reference to current active job
  },
  
  // Merchant State
  merchantState: {
    shopId: "shop-5", // "Khandesh Spicy Restaurant" by default for the demo
    earnings: 1450,
    ordersCount: 8,
  }
};

// Mock Database
const mockData = {
  shops: [
    {
      id: "grocery-hub",
      name: "Daily Needs Delivery",
      category: "grocery",
      rating: 4.9,
      time: "15-30 mins",
      minOrder: 50,
      image: "grocery_hub",
      description: "Select standard daily needs items or write down a custom list below.",
      items: [
        { id: "g1", name: "Premium Lokwan Wheat Flour (5kg)", price: 220, unit: "bag", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/40122099_4-fortune-atta-chakki-fresh.jpg" },
        { id: "g2", name: "Khandeshi Kala Masala (250g)", price: 95, unit: "pack", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/100004547_1-mdh-masala-shahi-paneer.jpg" },
        { id: "g3", name: "Pure Groundnut Oil (1L)", price: 175, unit: "bottle", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/40180049_5-fortune-sunlite-refined-sunflower-oil.jpg" },
        { id: "g4", name: "Organic Basmati Rice (1kg)", price: 110, unit: "kg", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/283426_5-india-gate-basmati-rice-feast-rozzana.jpg" },
        { id: "g5", name: "Fresh Cow Milk (1L)", price: 62, unit: "packet", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/70001832_2-amul-taaza-fresh-toned-milk.jpg" },
        { id: "g6", name: "Local Jaggery / Gul (1kg)", price: 75, unit: "block", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/40004550_9-safe-harvest-jaggery-powder-pesticide-free.jpg" },
        { id: "g7", name: "Fresh Tapi Valley Bananas (1 Dozen)", price: 40, unit: "doz", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/10000027_32-fresho-banana-robusta.jpg" },
        { id: "g8", name: "Organic Farm Honey (500g)", price: 280, unit: "jar", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/240124_14-dabur-100-pure-honey-worlds-no1-honey-brand-with-no-sugar-adulteration.jpg" },
        { id: "g9", name: "Fresh Local Tomatoes (1kg)", price: 30, unit: "kg", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/40022636_12-fresho-tomato-hybrid-organically-grown.jpg" },
        { id: "g10", name: "Desi Garlic / Lasun (250g)", price: 60, unit: "pack", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/10000115_17-fresho-garlic.jpg" },
        { id: "new_g1", name: "Aashirvaad Atta (5kg)", price: 120, unit: "bag", stock: true, img: "public/product_images/Aashirvaad_Atta.jpg" },
        { id: "new_g2", name: "Amul Butter (500g)", price: 200, unit: "pack", stock: true, img: "public/product_images/Amul_Butter.jpg" },
        { id: "new_g3", name: "Ariel Detergent (500g)", price: 99, unit: "pack", stock: true, img: "public/product_images/Ariel_Detergent.jpg" },
        { id: "new_g4", name: "Bournvita (500g)", price: 99, unit: "pack", stock: true, img: "public/product_images/Bournvita.jpg" },
        { id: "new_g5", name: "Britannia Rusk (300g)", price: 80, unit: "pack", stock: true, img: "public/product_images/Britannia_Rusk.jpg" },
        { id: "new_g6", name: "Clinic Plus Shampoo (340ml)", price: 99, unit: "bottle", stock: true, img: "public/product_images/Clinic_Plus_Shampoo.jpg" },
        { id: "new_g7", name: "Colgate Toothpaste (150g)", price: 99, unit: "pack", stock: true, img: "public/product_images/Colgate_Toothpaste.jpg" },
        { id: "new_g8", name: "Dettol Liquid (125ml)", price: 50, unit: "bottle", stock: true, img: "public/product_images/Dettol_Liquid.jpg" },
        { id: "new_g9", name: "Dove Soap (3x75g)", price: 99, unit: "pack", stock: true, img: "public/product_images/Dove_Soap.jpg" },
        { id: "new_g10", name: "Fortune Sunlite Oil (500ml)", price: 50, unit: "bottle", stock: true, img: "public/product_images/Fortune_Oil.jpg" },
        { id: "new_g11", name: "Godrej Hair Dye (40ml)", price: 120, unit: "pack", stock: true, img: "public/product_images/Godrej_Hair_Dye.jpg" },
        { id: "new_g12", name: "Good Day Cookies (200g)", price: 80, unit: "pack", stock: true, img: "public/product_images/Good_Day_Cookies.jpg" },
        { id: "new_g13", name: "Harpic Toilet Cleaner (1L)", price: 300, unit: "bottle", stock: true, img: "public/product_images/Harpic_Toilet_Cleaner.jpg" },
        { id: "new_g14", name: "Himalaya Face Wash (150ml)", price: 200, unit: "tube", stock: true, img: "public/product_images/Himalaya_Face_Wash.jpg" },
        { id: "new_g15", name: "Maggi Noodles (12-pack)", price: 120, unit: "pack", stock: true, img: "public/product_images/Maggi_Noodles.jpg" },
        { id: "new_g16", name: "Nestle Milk (1L)", price: 120, unit: "carton", stock: true, img: "public/product_images/Nestle_Milk.jpg" },
        { id: "new_g17", name: "Parle-G Biscuits (800g)", price: 300, unit: "pack", stock: true, img: "public/product_images/Parle_G_Biscuits.jpg" },
        { id: "new_g18", name: "Red Label Tea (500g)", price: 300, unit: "pack", stock: true, img: "public/product_images/Red_Label_Tea.jpg" },
        { id: "new_g19", name: "Tata Salt (1kg)", price: 120, unit: "bag", stock: true, img: "public/product_images/Tata_Salt.jpg" },
        { id: "new_g20", name: "Tata Tea Gold (250g)", price: 99, unit: "pack", stock: true, img: "public/product_images/Tata_Tea_Gold.jpg" }
      ]
    },
    {
      id: "shop-3",
      name: "Tapi Valley Pharmacy",
      category: "medicine",
      rating: 4.9,
      time: "15-25 mins",
      minOrder: 50,
      image: "pharmacy",
      description: "Prescription medicines, healthcare supplements, and baby care essentials.",
      items: [
        { id: "m1", name: "Paracetamol 650mg (15 Tabs)", price: 32, unit: "strip", stock: true, img: "paracetamol" },
        { id: "m2", name: "Vitamin C + Zinc Chewables (15 Tabs)", price: 75, unit: "strip", stock: true, img: "vitaminc" },
        { id: "m3", name: "Antiseptic Liquid Savlon (200ml)", price: 90, unit: "bottle", stock: true, img: "https://www.bbassets.com/media/uploads/p/xxl/182203_3-savlon-antiseptic-disinfectant-liquid.jpg" },
        { id: "m4", name: "Electronic Digital Thermometer", price: 249, unit: "piece", stock: true, img: "thermometer" },
        { id: "m5", name: "Multivitamin Capsules (30 Tabs)", price: 180, unit: "bottle", stock: true, img: "multivitamin" }
      ]
    },
    {
      id: "shop-4",
      name: "Bhusawal Junction Medicos",
      category: "medicine",
      rating: 4.7,
      time: "10-20 mins",
      minOrder: 80,
      image: "medicos",
      description: "A wide range of generic medicines, medical gear, and first aid kits.",
      items: [
        { id: "m6", name: "First Aid Safety Kit (Compact)", price: 199, unit: "box", stock: true, img: "firstaid" },
        { id: "m7", name: "Pain Relief Gel Fast-Acting (30g)", price: 85, unit: "tube", stock: true, img: "paingel" },
        { id: "m8", name: "N95 Face Masks (Pack of 5)", price: 120, unit: "pack", stock: true, img: "masks" },
        { id: "m9", name: "Ayurvedic Cough Syrup (100ml)", price: 65, unit: "bottle", stock: true, img: "coughsyrup" }
      ]
    },
    {
      id: "shop-5",
      name: "Khandesh Spicy Restaurant",
      category: "food",
      rating: 4.7,
      time: "20-35 mins",
      minOrder: 120,
      image: "spicy_restaurant",
      description: "Authentic spicy Khandeshi Shev Bhaji, Jowar Bhakri, and local delicacies.",
      items: [
        { id: "f1", name: "Special Khandeshi Shev Bhaji (Double Masala)", price: 140, unit: "plate", stock: true, img: "shevbhaji" },
        { id: "f2", name: "Hot Jowar Bhakri (Freshly Baked)", price: 25, unit: "pc", stock: true, img: "bhakri" },
        { id: "f3", name: "Spicy Baingan Bharta (Khandeshi Style)", price: 130, unit: "plate", stock: true, img: "bharta" },
        { id: "f4", name: "Varan Batti Toop / Dal Bati Combo", price: 180, unit: "combo", stock: true, img: "dalbati" },
        { id: "f5", name: "Thick Spiced Buttermilk / Taak (300ml)", price: 30, unit: "glass", stock: true, img: "taak" }
      ]
    },
    {
      id: "shop-6",
      name: "Tapi River Biryani House",
      category: "food",
      rating: 4.5,
      time: "25-40 mins",
      minOrder: 150,
      image: "biryani_house",
      description: "Fragrant local Dum Biryani prepared with specialized Khandeshi spices.",
      items: [
        { id: "f6", name: "Hyderabadi Chicken Dum Biryani", price: 220, unit: "portion", stock: true, img: "chickenbiryani" },
        { id: "f7", name: "Khandeshi Veg Dum Biryani", price: 170, unit: "portion", stock: true, img: "vegbiryani" },
        { id: "f8", name: "Paneer Tikka Masala Biryani", price: 190, unit: "portion", stock: true, img: "paneerbiryani" },
        { id: "f9", name: "Spiced Boondi Raita", price: 50, unit: "cup", stock: true, img: "raita" },
        { id: "f10", name: "Special Desi Ghee Gulab Jamun (2 Pcs)", price: 45, unit: "plate", stock: true, img: "gulabjamun" }
      ]
    }
  ],
  
  drivers: [
    { id: "d1", name: "Sachin Patil", type: "auto", vehicle: "Auto Rickshaw", plate: "MH-19-AQ-4231", rating: 4.8, ratePerKm: 15, baseFare: 30, phone: "9876543210" },
    { id: "d2", name: "Rahul Tayade", type: "erickshaw", vehicle: "E-Rickshaw", plate: "MH-19-ER-8842", rating: 4.7, ratePerKm: 10, baseFare: 20, phone: "9876543211" },
    { id: "d3", name: "Nitin Phalak", type: "cab", vehicle: "Cab / Sedan", plate: "MH-19-BJ-7765", rating: 4.9, ratePerKm: 25, baseFare: 60, phone: "9876543212" },
    { id: "d4", name: "Anand Chaudhari", type: "delivery", vehicle: "Motorcycle", plate: "MH-19-DP-3312", rating: 4.9, ratePerKm: 8, baseFare: 25, phone: "9876543213" },
    { id: "d5", name: "Swapnil Mahajan", type: "delivery", vehicle: "Electric Scooter", plate: "MH-19-DP-5541", rating: 4.6, ratePerKm: 6, baseFare: 25, phone: "9876543214" }
  ],
  
  landmarks: {
    "railway_junction": { name: "Bhusawal Railway Junction", x: 400, y: 350 },
    "jamner_road": { name: "Jamner Road Chowk", x: 450, y: 460 },
    "khadaka_road": { name: "Khadaka Road Residential", x: 220, y: 380 },
    "tapi_bridge": { name: "Tapi River Bridge", x: 500, y: 150 },
    "subhash_chowk": { name: "Subhash Chowk Bazaar", x: 350, y: 440 },
    "koteshwar_temple": { name: "Koteshwar Mahadev Temple", x: 620, y: 300 },
    "national_highway": { name: "NH-53 Bypass", x: 480, y: 550 }
  }
};

// Local storage helper
const STORAGE_KEY = 'bhusawal_connect_state';

class AppState {
  constructor() {
    this.state = { ...initialState };
    this.listeners = [];
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge structures carefully
        this.state = { ...this.state, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load local state", e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Failed to save state", e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify() {
    this.saveToStorage();
    this.listeners.forEach(listener => listener(this.state));
  }

  // State Modifiers
  setPortal(portal) {
    this.state.activePortal = portal;
    this.notify();
  }

  setCustomerPage(page) {
    this.state.customerPage = page;
    this.notify();
  }

  toggleTheme() {
    this.state.theme = this.state.theme === 'dark' ? 'light' : 'dark';
    this.notify();
  }

  // Cart actions
  addToCart(shopId, shopName, item) {
    const cart = this.state.cart;
    
    // Clear cart if adding from a different shop
    if (cart.shopId && cart.shopId !== shopId) {
      cart.items = [];
    }
    
    cart.shopId = shopId;
    cart.shopName = shopName;
    
    const existing = cart.items.find(i => i.id === item.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      cart.items.push({
        id: item.id || Math.random().toString(),
        name: item.name,
        price: item.price,
        quantity: 1
      });
    }
    
    this.recalculateCart();
  }

  removeFromCart(itemId) {
    const cart = this.state.cart;
    const existing = cart.items.find(i => i.id === itemId);
    
    if (existing) {
      existing.quantity -= 1;
      if (existing.quantity <= 0) {
        cart.items = this.state.cart.items.filter(i => i.id !== itemId);
      }
    }
    
    if (cart.items.length === 0) {
      cart.shopId = null;
      cart.shopName = '';
    }
    
    this.recalculateCart();
  }

  clearCart() {
    this.state.cart = {
      shopId: null,
      shopName: '',
      items: [],
      subtotal: 0,
      deliveryFee: 40,
      total: 0
    };
    this.notify();
  }

  recalculateCart() {
    const cart = this.state.cart;
    cart.subtotal = cart.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cart.deliveryFee = cart.subtotal > 300 ? 0 : 30; // Free delivery above 300
    cart.total = cart.subtotal + cart.deliveryFee;
    this.notify();
  }

  // Placing order
  placeOrder(address) {
    const cart = this.state.cart;
    if (cart.items.length === 0) return null;
    
    const orderId = "BC-" + Math.floor(1000 + Math.random() * 9000);
    const shop = mockData.shops.find(s => s.id === cart.shopId);
    
    // Choose a random delivery agent
    const deliveryAgents = mockData.drivers.filter(d => d.type === 'delivery');
    const agent = deliveryAgents[Math.floor(Math.random() * deliveryAgents.length)];

    const newOrder = {
      id: orderId,
      customerName: "Sahil Chaudhari",
      shopId: cart.shopId,
      shopName: cart.shopName,
      type: shop ? shop.category : 'grocery',
      items: [...cart.items],
      subtotal: cart.subtotal,
      deliveryFee: cart.deliveryFee,
      total: cart.total,
      address: address,
      status: "pending",
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16),
      deliveryAgent: agent.name,
      agentPhone: agent.phone,
      agentPlate: agent.plate,
      eta: "25 mins"
    };

    this.state.orders.unshift(newOrder);
    this.clearCart();
    
    // Switch customer page to tracking the new order
    this.state.customerPage = 'tracking';
    this.state.trackingOrderId = orderId;
    this.notify();
    
    return newOrder;
  }

  // Update order status (used by simulators & merchant)
  updateOrderStatus(orderId, status) {
    const order = this.state.orders.find(o => o.id === orderId);
    if (order) {
      order.status = status;
      
      // If completed, add to merchant earnings if it belongs to their shop
      if (status === 'completed' && order.shopId === this.state.merchantState.shopId) {
        this.state.merchantState.earnings += order.subtotal;
        this.state.merchantState.ordersCount += 1;
      }
      
      // If completed, add to driver earnings if driver is active
      if (status === 'completed' && this.state.driverState.isOnline) {
        this.state.driverState.earnings += order.deliveryFee + 10; // delivery fee + tip
        this.state.driverState.tripsCompleted += 1;
      }
      
      this.notify();
    }
  }

  // Book a local ride
  bookRide(pickup, dropoff, transportType) {
    const drivers = mockData.drivers.filter(d => d.type === transportType);
    if (drivers.length === 0) return null;
    
    // Pick the best driver
    const driver = drivers[Math.floor(Math.random() * drivers.length)];
    
    // Calculate simulated fare (rough distance base)
    const baseVal = driver.baseFare;
    const perKm = driver.ratePerKm;
    const distanceKm = (3 + Math.random() * 5).toFixed(1); // 3 to 8 km
    const fare = Math.round(baseVal + (distanceKm * perKm));

    const bookingId = "TX-" + Math.floor(1000 + Math.random() * 9000);
    const newBooking = {
      id: bookingId,
      pickup: pickup,
      dropoff: dropoff,
      type: transportType,
      driverName: driver.name,
      driverVehicle: driver.vehicle,
      driverPlate: driver.plate,
      driverPhone: driver.phone,
      driverRating: driver.rating,
      distance: distanceKm + " km",
      fare: fare,
      status: "assigned", // assigned, pickup, active, completed
      eta: "4 mins",
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };

    this.state.bookings.unshift(newBooking);
    
    // Track booking
    this.state.customerPage = 'tracking';
    this.state.trackingBookingId = bookingId;
    this.notify();
    
    return newBooking;
  }

  updateBookingStatus(bookingId, status) {
    const booking = this.state.bookings.find(b => b.id === bookingId);
    if (booking) {
      booking.status = status;
      if (status === 'completed' && this.state.driverState.isOnline) {
        this.state.driverState.earnings += booking.fare;
        this.state.driverState.tripsCompleted += 1;
      }
      this.notify();
    }
  }

  // Dispatch details for Driver Portal
  toggleDriverOnline() {
    this.state.driverState.isOnline = !this.state.driverState.isOnline;
    if (!this.state.driverState.isOnline) {
      this.state.driverState.currentJob = null;
    }
    this.notify();
  }

  assignJobToDriver(job) {
    this.state.driverState.currentJob = job;
    this.notify();
  }

  completeDriverJob() {
    const job = this.state.driverState.currentJob;
    if (job) {
      if (job.id.startsWith("BC")) {
        this.updateOrderStatus(job.id, 'completed');
      } else if (job.id.startsWith("TX")) {
        this.updateBookingStatus(job.id, 'completed');
      }
      this.state.driverState.currentJob = null;
      this.notify();
    }
  }

  // Merchant items operations
  addMerchantItem(item) {
    const shop = mockData.shops.find(s => s.id === this.state.merchantState.shopId);
    if (shop) {
      shop.items.push({
        id: "mi-" + Math.random().toString().substring(2, 6),
        name: item.name,
        price: Number(item.price),
        unit: item.unit || "unit",
        stock: true,
        img: item.img || "food"
      });
      this.notify();
    }
  }

  toggleMerchantStock(itemId) {
    const shop = mockData.shops.find(s => s.id === this.state.merchantState.shopId);
    if (shop) {
      const item = shop.items.find(i => i.id === itemId);
      if (item) {
        item.stock = !item.stock;
        this.notify();
      }
    }
  }
}

// Instantiate state globally
const store = new AppState();
window.store = store;
window.mockData = mockData;
export { store, mockData };
