import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as bcrypt from "bcryptjs";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const roles = [
    "Superadmin",
    "Admin",
    "Project Manager",
    "PPIC",
    "Engineering",
    "Sales",
    "Warehouse",
    "Purchasing",
    "Production",
    "Quality Control",
    "Logistic",
    "Founder",
    "Finance",
  ];

  console.log("Seeding roles...");
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  console.log("Seeding default superadmin...");
  const hashedPassword = await bcrypt.hash("superadmin", 10);

  const superadmin = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {
      password: hashedPassword,
    },
    create: {
      username: "superadmin",
      email: "admin@jlu.co.id",
      name: "Master Admin",
      password: hashedPassword,
      position: "System Administrator",
      roles: {
        connect: { name: "Superadmin" },
      },
    },
  });

  console.log({ superadmin });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
