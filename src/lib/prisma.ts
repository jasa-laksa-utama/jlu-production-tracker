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
  
  const client = new PrismaClient({ adapter });
  return client;
};

declare global {
  var prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined;
}

// In development, ensure we always use the latest generated schema models
if (process.env.NODE_ENV !== 'production' && globalThis.prismaGlobal) {
  const hasSubItems = (globalThis.prismaGlobal as any)._runtimeDataModel?.models?.StructureItem?.fields?.some(
    (f: any) => f.name === 'subItems'
  );
  const hasMarkingCode = (globalThis.prismaGlobal as any)._runtimeDataModel?.models?.StructureItem?.fields?.some(
    (f: any) => f.name === 'markingCode'
  );
  const hasOfficeBoQ = Boolean((globalThis.prismaGlobal as any).officeBoQ);
  const hasOfficeBoQItemId = (globalThis.prismaGlobal as any)._runtimeDataModel?.models?.OfficeBoQItem?.fields?.some(
    (f: any) => f.name === 'itemId'
  );
  const hasCustomerCity = (globalThis.prismaGlobal as any)._runtimeDataModel?.models?.Customer?.fields?.some(
    (f: any) => f.name === 'city'
  );
  if (!hasSubItems || !hasMarkingCode || !hasOfficeBoQ || !hasOfficeBoQItemId || !hasCustomerCity) {
    try {
      (globalThis.prismaGlobal as any).$disconnect?.();
    } catch {}
    globalThis.prismaGlobal = undefined;
  }
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
