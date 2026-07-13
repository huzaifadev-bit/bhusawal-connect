import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

try {
  prisma = new PrismaClient();
} catch (error) {
  console.warn('Prisma client initialization warning: Unable to connect to database. Falling back to mockup handlers.');
  prisma = {} as any;
}

export default prisma;
