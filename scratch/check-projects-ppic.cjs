const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    select: {
      id: true,
      projectNumber: true,
      projectName: true,
      status: true,
      ppicStatus: true,
      engStatus: true,
      createdAt: true
    }
  });
  console.log("Total Projects in DB:", projects.length);
  console.log(JSON.stringify(projects, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
