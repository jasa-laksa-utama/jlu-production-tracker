import "dotenv/config";
import prisma from "../src/lib/prisma";

const bc03Items = [
  { name: "Belt BANDO GT BW.1200 x EP630 x 4Ply x 5/2", qty: 352, satuan: "mtr" },
  { name: "Electric Motor 132 kW", qty: 1, satuan: "unit" },
  { name: "Gearbox Ratio 12,5", qty: 1, satuan: "unit" },
  { name: "Bracket Transition 20°-30°", qty: 2, satuan: "set" },
  { name: "Bracket Impact 45°", qty: 7, satuan: "set" },
  { name: "Bracket Carry 45°", qty: 138, satuan: "set" },
  { name: "Bracket Return", qty: 66, satuan: "set" },
  { name: "Self Aligning Carry (SACI)", qty: 6, satuan: "pcs" },
  { name: "Self Aligning Return (SARI)", qty: 6, satuan: "pcs" },
  { name: "Roller Impact Ø89/139xL.420 mm", qty: 21, satuan: "pcs" },
  { name: "Roller Carry Ø139xL.420 mm", qty: 440, satuan: "pcs" },
  { name: "Roller Return Ø127xL.1300 mm", qty: 72, satuan: "pcs" },
  { name: "Guide Roller Ø60xL.120 mm", qty: 23, satuan: "pcs" },
  { name: "Primary Belt Cleaner BW.1200", qty: 1, satuan: "pcs" },
  { name: "Secondary Belt Cleaner BW.1200", qty: 1, satuan: "pcs" },
  { name: "V-Plought BW.1200", qty: 1, satuan: "pcs" },
  { name: "Drive Pulley", qty: 1, satuan: "set" },
  { name: "LT Pulley, Take UP", qty: 3, satuan: "set" },
  { name: "Tail Pulley", qty: 1, satuan: "set" },
  { name: "HT Pulley", qty: 1, satuan: "set" },
  { name: "Head Pulley", qty: 1, satuan: "set" },
  { name: "Snub Pulley", qty: 2, satuan: "set" },
  { name: "Magnet Separator", qty: 1, satuan: "set" },
];

const bc04Items = [
  { name: "Belt BANDO GT BW.1200 x EP630 x 4Ply x 5/2", qty: 246, satuan: "mtr" },
  { name: "Electric Motor 132 kW", qty: 1, satuan: "unit" },
  { name: "Gearbox Ratio 12,5", qty: 1, satuan: "unit" },
  { name: "Electric Motor 2,2 kW", qty: 1, satuan: "unit" },
  { name: "Bracket Transition 20°-30°", qty: 2, satuan: "set" },
  { name: "Bracket Impact 45°", qty: 8, satuan: "set" },
  { name: "Bracket Carry 45°", qty: 96, satuan: "set" },
  { name: "Bracket Return", qty: 46, satuan: "set" },
  { name: "Self Aligning Carry (SACI)", qty: 4, satuan: "set" },
  { name: "Self Aligning Return (SARI)", qty: 4, satuan: "set" },
  { name: "Roller Impact Ø89/139xL.420 mm", qty: 24, satuan: "pcs" },
  { name: "Roller Carry Ø139xL.420 mm", qty: 306, satuan: "pcs" },
  { name: "Roller Return Ø127xL.1300 mm", qty: 50, satuan: "pcs" },
  { name: "Guide Roller Ø60xL.120 mm", qty: 16, satuan: "pcs" },
  { name: "Primary Belt Cleaner BW.1200", qty: 1, satuan: "pcs" },
  { name: "Secondary Belt Cleaner BW.1200", qty: 1, satuan: "pcs" },
  { name: "V-Plought BW.1200", qty: 1, satuan: "pcs" },
  { name: "Drive Pulley", qty: 1, satuan: "set" },
  { name: "LT Pulley, Take UP", qty: 3, satuan: "set" },
  { name: "Tail Pulley", qty: 1, satuan: "set" },
  { name: "HT Pulley", qty: 1, satuan: "set" },
  { name: "Head Pulley", qty: 1, satuan: "set" },
  { name: "Snub Pulley", qty: 2, satuan: "set" },
  { name: "Belt Scale", qty: 1, satuan: "set" },
];

async function seedUnitMechanicalReset(unitSearchName: string, itemsData: typeof bc03Items) {
  const units = await prisma.conveyorUnit.findMany({
    where: {
      name: {
        contains: unitSearchName,
        mode: "insensitive",
      },
    },
  });

  if (units.length === 0) {
    console.log(`❌ Unit dengan nama "${unitSearchName}" tidak ditemukan.`);
    return;
  }

  for (const unit of units) {
    console.log(`\n⚙️ Memproses Reset Unit: ${unit.name} (ID: ${unit.id})`);

    // 1. Delete existing mechanical items
    await prisma.mechanicalItem.deleteMany({
      where: { unitId: unit.id },
    });
    console.log(`   └─ Menghapus item mekanikal terdahulu...`);

    // 2. Insert new mechanical items with steps reset to 0
    const createdItems = [];
    for (let i = 0; i < itemsData.length; i++) {
      const it = itemsData[i];
      
      const created = await prisma.mechanicalItem.create({
        data: {
          unitId: unit.id,
          name: it.name,
          qty: it.qty,
          satuan: it.satuan,
          orderIndex: i + 1,
          procurementQty: 0,
          poQty: 0,
          fabricationQty: 0,
          packagingQty: 0,
          procurementDone: false,
          poDone: false,
          fabricationDone: false,
          packagingDone: false,
          progressPercent: 0,
        },
      });
      createdItems.push(created);
    }
    console.log(`   └─ Sukses reset & menambahkan ${createdItems.length} item mekanikal dengan progress step = 0.`);
  }
}

async function main() {
  console.log("🚀 Memulai Reset progress step komponen mekanikal BC 03 & BC 04 ke 0...");
  await seedUnitMechanicalReset("BC 03", bc03Items);
  await seedUnitMechanicalReset("BC 04", bc04Items);
  console.log("\n✅ Reset Progress Step Selesai!");
}

main()
  .catch((e) => {
    console.error("❌ Error saat reset:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
