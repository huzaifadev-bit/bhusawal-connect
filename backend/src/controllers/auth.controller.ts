import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'bhusawal_connect_super_secret_key_12345';

// Mock DB storage in case PostgreSQL is offline
const inMemoryUsers: any[] = [
  { id: '1', phone: '+919999999999', name: 'Sahil Patel', role: 'CUSTOMER' },
  { id: '2', phone: '+918888888888', name: 'Rahul Sharma', role: 'MERCHANT' },
  { id: '3', phone: '+917777777777', name: 'Vikram Mehta', role: 'RIDER' }
];

export const requestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Mobile number is required.' });
  }

  console.log(`[AUTH] OTP request for phone: ${phone}. Sent mock OTP: 123456`);
  res.status(200).json({ success: true, message: 'OTP sent successfully (Use 123456 to log in)' });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required.' });
  }

  if (otp !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP code.' });
  }

  try {
    let user: any = null;

    // Attempt to read from PostgreSQL database
    try {
      user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: { phone, role: 'CUSTOMER' }
        });
      }
    } catch (dbError) {
      console.warn('[AUTH] Database connection failed. Falling back to in-memory login.');
      user = inMemoryUsers.find(u => u.phone === phone);
      if (!user) {
        user = { id: `MOCK-${Date.now()}`, phone, role: 'CUSTOMER', name: 'Guest User' };
        inMemoryUsers.push(user);
      }
    }

    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name || 'Bhusawal Resident',
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Verification failed.' });
  }
};
