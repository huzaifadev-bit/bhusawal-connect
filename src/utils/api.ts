// Bhusawal Connect Web Dashboard / Client API Integration Utility

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Make API requests to the Bhusawal Connect Node.js backend.
 * Falls back gracefully to localStorage or custom mock data in case the backend server is offline.
 */
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.warn(`[API] Fetch failed for ${path}. Server might be offline. Error:`, error);
    return null;
  }
}

export const authApi = {
  requestOtp: (phone: string) => apiFetch<{ success: boolean; message: string }>('/auth/request-otp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),
  
  verifyOtp: (phone: string, otp: string) => apiFetch<{ success: boolean; token: string; user: any }>('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone, otp }),
  }),
};

export const storeApi = {
  getStores: (type?: string) => apiFetch<any[]>(`/stores${type ? `?type=${type}` : ''}`),
  getStoreProducts: (storeId: string) => apiFetch<any[]>(`/stores/${storeId}/products`),
};

export const orderApi = {
  createOrder: (userId: string, storeId: string, items: any[], total: number) => apiFetch<{ success: boolean; order: any }>('/orders', {
    method: 'POST',
    body: JSON.stringify({ userId, storeId, items, total }),
  }),
  
  getOrders: (userId?: string) => apiFetch<any[]>(`/orders${userId ? `?userId=${userId}` : ''}`),
  
  updateOrderStatus: (orderId: string, status: string) => apiFetch<{ success: boolean; order: any }>(`/orders/${orderId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
};

export const rideApi = {
  bookRide: (customerId: string, pickupAddress: string, dropAddress: string, fare: number) => apiFetch<{ success: boolean; ride: any }>('/rides', {
    method: 'POST',
    body: JSON.stringify({ customerId, pickupAddress, dropAddress, fare }),
  }),
  
  updateRideStatus: (rideId: string, status: string) => apiFetch<{ success: boolean; ride: any }>(`/rides/${rideId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),
};
