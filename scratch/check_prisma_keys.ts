import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const keys = Object.keys(prisma).filter(k => k.toLowerCase().includes("checkpoint"));
  console.log("Prisma keys matching 'checkpoint':", keys);
  console.log("prisma.qCItemCheckpoint type:", typeof (prisma as any).qCItemCheckpoint);
  console.log("prisma.qcItemCheckpoint type:", typeof (prisma as any).qcItemCheckpoint);
}

main();
