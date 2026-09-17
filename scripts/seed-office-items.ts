import prisma from "../src/lib/prisma";

async function main() {
  console.log("Checking category B & C items in database...");

  const existing = await prisma.item.findMany({
    where: { category: { in: ["B", "C"] } },
  });

  if (existing.length > 0) {
    console.log(`Found ${existing.length} items with category B or C already.`);
    return;
  }

  console.log("No category B or C items found. Seeding sample office master items...");

  // Ambil unit ID yang ada
  const pcsUnit = await prisma.unit.findFirst({ where: { name: "PCS" } });
  const unitUnit = await prisma.unit.findFirst({ where: { name: "UNIT" } });
  const rollUnit = await prisma.unit.findFirst({ where: { name: "ROLL" } });

  const sampleItems = [
    // Kategori B: ATK & IT Peralatan Kantor
    {
      code: "ATK_001",
      name: "Kertas HVS A4 75 GSM PaperOne",
      typeMerk: "PaperOne",
      category: "B",
      itemCategory: "CONSUMABLE",
      unitPrice: 48000,
      initialStock: 30,
      currentStock: 25,
      minStock: 5,
      unitId: pcsUnit?.id,
      description: "Kertas cetak dokumen kantor A4",
    },
    {
      code: "ATK_002",
      name: "Spidol Boardmarker Hitam Snowman",
      typeMerk: "Snowman",
      category: "B",
      itemCategory: "CONSUMABLE",
      unitPrice: 9500,
      initialStock: 50,
      currentStock: 42,
      minStock: 10,
      unitId: pcsUnit?.id,
      description: "Spidol whiteboard hitam",
    },
    {
      code: "ATK_003",
      name: "Buku Ekspedisi Folio Hardcover",
      typeMerk: "Kiky",
      category: "B",
      itemCategory: "CONSUMABLE",
      unitPrice: 22000,
      initialStock: 15,
      currentStock: 12,
      minStock: 3,
      unitId: pcsUnit?.id,
      description: "Buku agenda pengiriman kantor",
    },
    {
      code: "IT_001",
      name: "Mouse Wireless Silent M330",
      typeMerk: "Logitech",
      category: "B",
      itemCategory: "ASSET",
      unitPrice: 165000,
      initialStock: 10,
      currentStock: 7,
      minStock: 2,
      unitId: unitUnit?.id,
      description: "Mouse nirkabel untuk staf kantor",
    },
    {
      code: "IT_002",
      name: "Flashdisk 64GB USB 3.0 Ultra Flair",
      typeMerk: "SanDisk",
      category: "B",
      itemCategory: "ASSET",
      unitPrice: 95000,
      initialStock: 10,
      currentStock: 8,
      minStock: 2,
      unitId: unitUnit?.id,
      description: "Penyimpanan data portabel",
    },
    {
      code: "ATK_004",
      name: "Lakban Bening 2 Inch x 100 Yard",
      typeMerk: "Daimaru",
      category: "B",
      itemCategory: "CONSUMABLE",
      unitPrice: 14000,
      initialStock: 24,
      currentStock: 18,
      minStock: 5,
      unitId: rollUnit?.id,
      description: "Lakban packing dokumen",
    },

    // Kategori C: Pantry & Fasilitas / Kebersihan Kantor
    {
      code: "PAN_001",
      name: "Kopi Kapal Api Special Mix (Pack 20 Sachet)",
      typeMerk: "Kapal Api",
      category: "C",
      itemCategory: "CONSUMABLE",
      unitPrice: 32000,
      initialStock: 20,
      currentStock: 15,
      minStock: 5,
      unitId: pcsUnit?.id,
      description: "Konsumsi kopi kantor",
    },
    {
      code: "PAN_002",
      name: "Gula Pasir Kristal Putih 1 Kg",
      typeMerk: "Gulaku",
      category: "C",
      itemCategory: "CONSUMABLE",
      unitPrice: 19500,
      initialStock: 15,
      currentStock: 10,
      minStock: 3,
      unitId: pcsUnit?.id,
      description: "Gula dapur pantry",
    },
    {
      code: "FAC_001",
      name: "Sabun Cuci Tangan Botol Pump 500ml",
      typeMerk: "Lifebuoy",
      category: "C",
      itemCategory: "CONSUMABLE",
      unitPrice: 27500,
      initialStock: 15,
      currentStock: 11,
      minStock: 4,
      unitId: pcsUnit?.id,
      description: "Hand soap toilet kantor",
    },
    {
      code: "FAC_002",
      name: "Cairan Pembersih Lantai Lavender 800ml",
      typeMerk: "Wipol",
      category: "C",
      itemCategory: "CONSUMABLE",
      unitPrice: 19000,
      initialStock: 16,
      currentStock: 14,
      minStock: 4,
      unitId: pcsUnit?.id,
      description: "Pembersih dan disinfektan lantai",
    },
  ];

  for (const item of sampleItems) {
    await prisma.item.upsert({
      where: { code: item.code },
      update: {},
      create: item,
    });
  }

  console.log(`Successfully seeded ${sampleItems.length} office items (categories B & C)!`);
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
