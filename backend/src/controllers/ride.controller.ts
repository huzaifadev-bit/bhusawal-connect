import { Request, Response } from 'express';
import prisma from '../db';

const inMemoryRides: any[] = [];

export const bookRide = async (req: Request, res: Response) => {
  const { customerId, pickupAddress, dropAddress, fare } = req.body;

  if (!customerId || !pickupAddress || !dropAddress || !fare) {
    return res.status(400).json({ error: 'All ride fields are required.' });
  }

  const rideId = `RIDE-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    let ride;
    try {
      ride = await prisma.ride.create({
        data: {
          id: rideId,
          customerId,
          pickupAddress,
          dropAddress,
          fare,
          status: 'REQUESTED'
        }
      });
    } catch {
      console.warn('[RIDES] Database offline. Creating in-memory ride.');
      ride = {
        id: rideId,
        customerId,
        pickupAddress,
        dropAddress,
        fare,
        status: 'REQUESTED',
        createdAt: new Date(),
        driver: { name: 'Rahul S.', vehicle: 'MH-19-BQ-4529 Auto', rating: 4.9 }
      };
      inMemoryRides.unshift(ride);
    }
    res.status(201).json({ success: true, ride });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getRides = async (req: Request, res: Response) => {
  const { customerId } = req.query;

  try {
    let rides;
    try {
      if (customerId) {
        rides = await prisma.ride.findMany({
          where: { customerId: customerId as string },
          orderBy: { createdAt: 'desc' }
        });
      } else {
        rides = await prisma.ride.findMany({ orderBy: { createdAt: 'desc' } });
      }
    } catch {
      console.warn('[RIDES] Database offline. Reading in-memory rides.');
      rides = customerId ? inMemoryRides.filter(r => r.customerId === customerId) : inMemoryRides;
    }
    res.status(200).json(rides);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRideStatus = async (req: Request, res: Response) => {
  const { rideId } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status is required.' });
  }

  try {
    let ride;
    try {
      ride = await prisma.ride.update({
        where: { id: rideId },
        data: { status }
      });
    } catch {
      console.warn('[RIDES] Database offline. Updating in-memory ride status.');
      const localRide = inMemoryRides.find(r => r.id === rideId);
      if (localRide) {
        localRide.status = status;
        ride = localRide;
      } else {
        return res.status(404).json({ error: 'Ride not found.' });
      }
    }
    res.status(200).json({ success: true, ride });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
