import "dotenv/config";
import prisma from "../src/lib/prisma";
import bcrypt from "bcryptjs";

async function main() {
  const username = "superadmin";
  const email = "superadmin@jlu.com";
  const name = "Super Admin";
  const passwordText = "superadmin";

  console.log("Checking and seeding all required roles...");
  const roleNames = [
    "Superadmin",
    "Admin",
    "Sales / Marketing",
    "Engineering",
    "PPIC",
    "Purchasing",
    "Warehouse",
    "Logistic",
    "Production",
    "Quality Control"
  ];

  for (const rName of roleNames) {
    const exists = await prisma.role.findUnique({ where: { name: rName } });
    if (!exists) {
      console.log(`Creating role: ${rName}...`);
      await prisma.role.create({ data: { name: rName } });
    }
  }

  let adminRole = await prisma.role.findUnique({
    where: { name: "Superadmin" },
  });

  console.log("Checking if Superadmin user exists...");
  let user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
  });

  if (!user) {
    console.log(`Creating new user: ${username}`);
    const hashedPassword = await bcrypt.hash(passwordText, 10);
    if (!adminRole) {
      console.error("❌ Role 'Superadmin' not found. Please check seeding.");
      return;
    }

    user = await prisma.user.create({
      data: {
        username,
        email,
        name,
        password: hashedPassword,
        position: "Administrator",
        roles: {
          connect: { id: adminRole.id },
        },
      },
    });
    console.log("✅ Superadmin account successfully created!");
    console.log(`   Username: ${username}`);
    console.log(`   Password: ${passwordText}`);
  } else {
    console.log(
      "⚠️ Superadmin user already exists. If you want to reset password or roles, please modify the db manually.",
    );
  }
}

main()
  .catch((e) => {
    console.error("❌ Error creating superadmin:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
