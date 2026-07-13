import { Request, Response } from 'express';
import prisma from '../db';

const mockStores = [
  { id: 'store-1', name: 'Fresh Mart Bhusawal', type: 'GROCERY', address: 'Shivaji Nagar', rating: 4.8, isOpen: true },
  { id: 'store-2', name: 'Modern Pharmacy', type: 'MEDICINE', address: 'Main Road, Bhusawal', rating: 4.6, isOpen: true },
  { id: 'store-3', name: 'Spice Village', type: 'FOOD', address: 'Varangaon Road', rating: 4.2, isOpen: true }
];

const mockProducts: Record<string, any[]> = {
  'store-1': [
    { id: 'p1', name: 'Fresh Farm Whole Milk', price: 28, description: '500 ml glass bottle' },
    { id: 'p2', name: 'Organic Baby Spinach', price: 45, description: '200 g pack' },
    { id: 'p3', name: 'Premium Digestive Biscuits', price: 90, description: '250 g stack' }
  ],
  'store-2': [
    { id: 'p4', name: 'Paracetamol 650mg', price: 30, description: 'Strip of 15 tablets' },
    { id: 'p5', name: 'Dolo 650', price: 32, description: 'Strip of 15 tablets' },
    { id: 'p6', name: 'Cough Syrup', price: 105, description: '100 ml bottle' }
  ],
  'store-3': [
    { id: 'p7', name: 'Butter Chicken', price: 280, description: 'Premium North Indian Curry' },
    { id: 'p8', name: 'Garlic Naan', price: 45, description: 'Artisanal tandoor flatbread' },
    { id: 'p9', name: 'Paneer Butter Masala', price: 220, description: 'Rich cottage cheese gravy' }
  ]
};

export const getStores = async (req: Request, res: Response) => {
  const { type } = req.query;

  try {
    let stores;
    try {
      if (type) {
        stores = await prisma.store.findMany({ where: { type: type as any } });
      } else {
        stores = await prisma.store.findMany();
      }
    } catch {
      console.warn('[STORES] Database failed. Using mock stores.');
      stores = type ? mockStores.filter(s => s.type === type) : mockStores;
    }
    res.status(200).json(stores);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStoreProducts = async (req: Request, res: Response) => {
  const { storeId } = req.params;

  try {
    let products;
    try {
      products = await prisma.product.findMany({ where: { storeId } });
    } catch {
      console.warn('[PRODUCTS] Database failed. Using mock products.');
      products = mockProducts[storeId] || [];
    }
    res.status(200).json(products);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
