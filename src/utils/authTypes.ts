/**
 * ====================================================================
 * BHUSAWAL CONNECT — AUTHENTICATION ROLE TYPES & ENTITY SCHEMAS
 * ====================================================================
 */

export type UserRole = 
  | 'CUSTOMER'
  | 'DELIVERY_PARTNER'
  | 'MERCHANT'
  | 'RESTAURANT_PARTNER'
  | 'ADMIN'
  | 'SUPER_ADMIN';

export interface AuthUserProfile {
  uid: string;
  role: UserRole;
  phoneNumber?: string | null;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: string;
  lastLoginAt: string;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
}

export interface PhoneAuthSession {
  verificationId: string;
  phoneNumber: string;
  role: UserRole;
  createdAt: number;
}
