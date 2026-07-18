import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding units...");
  const unitsData = ["pcs", "meter", "kg", "set", "roll", "unit"];
  const unitsMap: Record<string, string> = {};
  for (const uName of unitsData) {
    const u = await prisma.unit.upsert({
      where: { name: uName },
      update: {},
      create: { name: uName },
    });
    unitsMap[uName] = u.id;
  }

  console.log("Seeding item types...");
  const itemTypesData = [
    { name: "Raw Material", codePrefix: "RM" },
    { name: "Sparepart", codePrefix: "SP" },
    { name: "Consumables", codePrefix: "CS" },
    { name: "Component", codePrefix: "CP" },
  ];
  const itemTypesMap: Record<string, string> = {};
  for (const it of itemTypesData) {
    const type = await prisma.itemType.upsert({
      where: { name: it.name },
      update: { codePrefix: it.codePrefix },
      create: { name: it.name, codePrefix: it.codePrefix },
    });
    itemTypesMap[it.name] = type.id;
  }

  console.log("Seeding default items...");
  const itemsData = [
    {
      code: "RM-001",
      name: "Besi H-Beam 150x150x7x10",
      typeMerk: "Gunung Garuda",
      initialStock: 100,
      currentStock: 100,
      minStock: 10,
      description: "Besi H-Beam untuk struktur utama conveyor frame",
      category: "A",
      itemTypeName: "Raw Material",
      unitName: "pcs",
    },
    {
      code: "RM-002",
      name: "Besi Channel UNP 120x55x7",
      typeMerk: "Krakatau Steel",
      initialStock: 250,
      currentStock: 250,
      minStock: 20,
      description: "Besi Channel UNP untuk penyangga roller dan support frame",
      category: "A",
      itemTypeName: "Raw Material",
      unitName: "pcs",
    },
    {
      code: "CP-001",
      name: "Conveyor Belt Rubber EP 150 B800 4ply x 8mm",
      typeMerk: "Bando",
      initialStock: 500,
      currentStock: 500,
      minStock: 50,
      description: "Rubber belt ply EP 150 lebar 800mm tebal 8mm",
      category: "A",
      itemTypeName: "Component",
      unitName: "meter",
    },
    {
      code: "CP-002",
      name: "Carrier Roller dia. 89 x L315",
      typeMerk: "JLU Custom",
      initialStock: 300,
      currentStock: 300,
      minStock: 30,
      description: "Roller pembawa material utama diameter 89mm panjang 315mm",
      category: "B",
      itemTypeName: "Component",
      unitName: "pcs",
    },
    {
      code: "CP-003",
      name: "Return Roller dia. 89 x L950",
      typeMerk: "JLU Custom",
      initialStock: 120,
      currentStock: 120,
      minStock: 15,
      description: "Roller kembali belt bawah lebar 800mm",
      category: "B",
      itemTypeName: "Component",
      unitName: "pcs",
    },
    {
      code: "CP-004",
      name: "Drive Pulley dia. 400 x L950 Lagged",
      typeMerk: "JLU Custom",
      initialStock: 10,
      currentStock: 10,
      minStock: 2,
      description: "Pulley penggerak utama dilapisi karet lagging diamond",
      category: "A",
      itemTypeName: "Component",
      unitName: "pcs",
    },
    {
      code: "CP-005",
      name: "Tail Pulley dia. 320 x L950 Plain",
      typeMerk: "JLU Custom",
      initialStock: 12,
      currentStock: 12,
      minStock: 2,
      description: "Pulley belakang/ekor conveyor tanpa lagging",
      category: "A",
      itemTypeName: "Component",
      unitName: "pcs",
    },
    {
      code: "SP-001",
      name: "Gearmotor Helical Bevel 15 kW 1/30 ratio",
      typeMerk: "SEW Eurodrive",
      initialStock: 5,
      currentStock: 5,
      minStock: 1,
      description: "Motor gearbox penggerak utama conveyor 15kW output ratio 30",
      category: "A",
      itemTypeName: "Sparepart",
      unitName: "unit",
    },
    {
      code: "SP-002",
      name: "Pillow Block Bearing UCP 215",
      typeMerk: "FYH",
      initialStock: 40,
      currentStock: 40,
      minStock: 8,
      description: "Bearing block untuk shaft pulley shaft diameter 75mm",
      category: "B",
      itemTypeName: "Sparepart",
      unitName: "pcs",
    },
    {
      code: "CS-001",
      name: "Kawat Las LB-52 U dia. 3.2mm",
      typeMerk: "Kobelco",
      initialStock: 150,
      currentStock: 150,
      minStock: 20,
      description: "Kawat las low hydrogen untuk sambungan konstruksi berat",
      category: "C",
      itemTypeName: "Consumables",
      unitName: "kg",
    },
  ];

  console.log("Upserting items...");
  for (const item of itemsData) {
    await prisma.item.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        typeMerk: item.typeMerk,
        initialStock: item.initialStock,
        currentStock: item.currentStock,
        minStock: item.minStock,
        description: item.description,
        category: item.category,
        itemTypeId: itemTypesMap[item.itemTypeName],
        unitId: unitsMap[item.unitName],
      },
      create: {
        code: item.code,
        name: item.name,
        typeMerk: item.typeMerk,
        initialStock: item.initialStock,
        currentStock: item.currentStock,
        minStock: item.minStock,
        description: item.description,
        category: item.category,
        itemTypeId: itemTypesMap[item.itemTypeName],
        unitId: unitsMap[item.unitName],
      },
    });
  }

  console.log("Items seed finished successfully!");
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
