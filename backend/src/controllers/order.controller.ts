import { Request, Response } from 'express';
import prisma from '../db';

const inMemoryOrders: any[] = [];

export const createOrder = async (req: Request, res: Response) => {
  const { userId, storeId, items, total } = req.body;

  if (!userId || !storeId || !items || !total) {
    return res.status(400).json({ error: 'All order fields are required.' });
  }

  const orderId = `BHU-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    let order;
    try {
      order = await prisma.order.create({
        data: {
          id: orderId,
          userId,
          storeId,
          items: typeof items === 'string' ? items : JSON.stringify(items),
          total,
          status: 'PENDING'
        }
      });
    } catch {
      console.warn('[ORDERS] Database offline. Creating in-memory order.');
      order = {
        id: orderId,
        userId,
        storeId,
        items: typeof items === 'string' ? items : JSON.stringify(items),
        total,
        status: 'PENDING',
        createdAt: new Date()
      };
      inMemoryOrders.unshift(order);
    }
    res.status(201).json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  const { userId } = req.query;

  try {
    let orders;
    try {
      if (userId) {
        orders = await prisma.order.findMany({
          where: { userId: userId as string },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' } });
      }
    } catch {
      console.warn('[ORDERS] Database offline. Reading in-memory orders.');
      orders = userId ? inMemoryOrders.filter(o => o.userId === userId) : inMemoryOrders;
    }
    res.status(200).json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { orderId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    let order;
    try {
      order = await prisma.order.update({
        where: { id: orderId },
        data: { status }
      });
    } catch {
      console.warn('[ORDERS] Database offline. Updating in-memory order status.');
      const localOrder = inMemoryOrders.find(o => o.id === orderId);
      if (localOrder) {
        localOrder.status = status;
        order = localOrder;
      } else {
        return res.status(404).json({ error: 'Order not found.' });
      }
    }
    res.status(200).json({ success: true, order });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
