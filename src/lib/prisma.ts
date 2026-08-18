if (typeof process !== 'undefined' && process.env) {
  process.env.TZ = 'Asia/Jakarta';
}

import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  // Use connection pooler URL for generic API runtime
  const connectionString = `${process.env.DATABASE_URL}`;
  
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  const client = new PrismaClient({ adapter }) as any;
  client.qCItemCheckpoint = true;
  return client as PrismaClient;
};

declare global {
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
}

// In development, ensure we always use the latest generated schema models
if (process.env.NODE_ENV !== 'production' && globalThis.prismaGlobal) {
  const hasQCStatus = (globalThis.prismaGlobal as any)._runtimeDataModel?.models?.PurchaseOrderItem?.fields?.some(
    (f: any) => f.name === 'qcStatus'
  );
  if (!hasQCStatus) {
    globalThis.prismaGlobal = undefined;
  }
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
