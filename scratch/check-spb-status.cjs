const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const spbs = await prisma.sPB.findMany({
    select: {
      id: true,
      spbNumber: true,
      status: true,
      approvedByPpic: true,
      approvedByPm: true,
      projectId: true,
      items: {
        select: {
          id: true,
          name: true,
          status: true,
          source: true,
          qty: true
        }
      }
    }
  });
  console.log(JSON.stringify(spbs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
