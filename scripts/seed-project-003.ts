import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  console.log("Mencari project dengan kode/nomor/nama Project-09-2026-003...");
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { projectNumber: { contains: "Project-09-2026-003", mode: "insensitive" } },
        { projectNumber: { contains: "003", mode: "insensitive" } },
        { projectName: { contains: "Project-09-2026-003", mode: "insensitive" } },
        { projectName: { contains: "003", mode: "insensitive" } },
      ],
    },
    include: {
      masterplan: {
        include: {
          phases: true,
          weeklyPlans: true,
        },
      },
      conveyorUnits: {
        include: {
          structureItems: { include: { subItems: true } },
          mechanicalItems: { include: { subItems: true } },
        },
      },
    },
  });

  if (!project) {
    console.error("Project tidak ditemukan! Cek daftar project:");
    const all = await prisma.project.findMany({
      select: { id: true, projectNumber: true, projectName: true },
      take: 10,
    });
    console.log(all);
    return;
  }

  console.log(`Ditemukan project: ID=${project.id}, Number=${project.projectNumber}, Name=${project.projectName}`);

  // Durasi pengerjaan: 12 Minggu
  const totalWeeks = 12;
  const startDate = project.masterplan?.startDate
    ? new Date(project.masterplan.startDate)
    : project.startDate
      ? new Date(project.startDate)
      : new Date("2026-09-14T00:00:00.000Z");

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + totalWeeks * 7);

  console.log(`Menyetel durasi pengerjaan: ${totalWeeks} Minggu (${startDate.toISOString().split("T")[0]} s/d ${endDate.toISOString().split("T")[0]})`);

  // Update expectedDate pada Project
  await prisma.project.update({
    where: { id: project.id },
    data: {
      expectedDate: endDate,
      startDate: startDate,
    },
  });

  // Hapus data conveyor unit lama pada project ini jika ada
  await prisma.conveyorUnit.deleteMany({
    where: { projectId: project.id },
  });

  console.log("Data conveyor unit lama dibersihkan. Memulai seeding unit, komponen, dan sub-komponen...");

  // Data Seeding Unit Conveyor & Komponen Lengkap untuk Pengujian
  const unitsData = [
    {
      name: "Belt Conveyor 01 (BC-01) - 50 Mtr",
      unitType: "BOTH",
      satuan: "unit",
      volume: 1,
      orderIndex: 0,
      markingCode: "BC-01",
      bundleTag: "SHIP-BC01",
      structureItems: [
        {
          name: "Rangka Utama Truss Span 12M",
          qty: 4,
          satuan: "unit",
          orderIndex: 0,
          markingCode: "BC01-STR-01",
          subItems: [
            { name: "UNP 120 x 55 x 7 mm x 6000mm", qty: 8, satuan: "btg", dimension: "UNP 120, L=6000mm" },
            { name: "Siku L 50 x 50 x 5 mm (Bracing)", qty: 24, satuan: "btg", dimension: "L 50x50x5, L=1500mm" },
            { name: "Gusset / Joint Plate 8mm", qty: 16, satuan: "pcs", dimension: "Plat 8mm x 250 x 300" },
          ],
        },
        {
          name: "Kaki Penyangga (Support Post H-Beam)",
          qty: 6,
          satuan: "set",
          orderIndex: 1,
          markingCode: "BC01-STR-02",
          subItems: [
            { name: "H-Beam 150 x 150 x 7 x 10 mm", qty: 6, satuan: "btg", dimension: "H-Beam 150, H=4500mm" },
            { name: "Base Plate 16mm", qty: 6, satuan: "pcs", dimension: "Plat 16mm x 400 x 400" },
            { name: "Anchor Bolt M24 x 600mm", qty: 24, satuan: "pcs", dimension: "Grade 8.8" },
          ],
        },
        {
          name: "Head Discharge Chute Liners",
          qty: 1,
          satuan: "unit",
          orderIndex: 2,
          markingCode: "BC01-STR-03",
          subItems: [
            { name: "Plat SS400 6mm (Chute Shell)", qty: 4, satuan: "lbr", dimension: "4' x 8' x 6mm" },
            { name: "Wear Plate Hardox 400 8mm", qty: 2, satuan: "lbr", dimension: "Liner Impact Area" },
          ],
        },
      ],
      mechanicalItems: [
        {
          name: "Drive Head Pulley Assembly Dia. 500 x 800mm",
          qty: 1,
          satuan: "unit",
          orderIndex: 0,
          markingCode: "BC01-MCH-01",
          subItems: [
            { name: "Shell Pipa Dia. 500mm x 12mm", qty: 1, satuan: "pcs", spec: "Seamless Tube L=800mm" },
            { name: "Shaft As ST60 Dia. 90mm x 1350mm", qty: 1, satuan: "pcs", spec: "Baja As ST60 Bubut" },
            { name: "Rubber Lagging Diamond 10mm", qty: 1, satuan: "lot", spec: "Vulcanized Diamond" },
            { name: "Pillow Block Bearing SN 518", qty: 2, satuan: "set", spec: "As 80mm FYH / SKF" },
          ],
        },
        {
          name: "Tail Pulley Assembly Dia. 400 x 800mm",
          qty: 1,
          satuan: "unit",
          orderIndex: 1,
          markingCode: "BC01-MCH-02",
          subItems: [
            { name: "Shell Pipa Dia. 400mm x 10mm", qty: 1, satuan: "pcs", spec: "L=800mm" },
            { name: "Shaft As ST60 Dia. 75mm x 1250mm", qty: 1, satuan: "pcs", spec: "ST60 Machined" },
            { name: "Take-Up Bearing UCT 213", qty: 2, satuan: "set", spec: "Tension Unit" },
          ],
        },
        {
          name: "Carry Troughing Roller Dia. 89 x 280mm",
          qty: 48,
          satuan: "unit",
          orderIndex: 2,
          markingCode: "BC01-MCH-03",
          subItems: [
            { name: "Pipa Roller ERW Dia. 89 x 3.2mm", qty: 48, satuan: "pcs", spec: "L=280mm" },
            { name: "Bearing 6204 2RS & Dust Seal", qty: 96, satuan: "set", spec: "Double Sealed" },
            { name: "As Hexagonal 17mm", qty: 48, satuan: "pcs", spec: "Cold Drawn Hex" },
          ],
        },
        {
          name: "Motor Gearbox Unit 15 kW Sumitomo",
          qty: 1,
          satuan: "set",
          orderIndex: 3,
          markingCode: "BC01-MCH-04",
          subItems: [
            { name: "Elektromotor 15 kW 380V 4P", qty: 1, satuan: "unit", spec: "B3 Foot Mounted" },
            { name: "Helical Bevel Reducer i=1:25", qty: 1, satuan: "unit", spec: "Sumitomo / Flender" },
            { name: "Fluid Coupling / Kopling", qty: 1, satuan: "set", spec: "Flexible Coupling" },
          ],
        },
      ],
    },
    {
      name: "Dump Hopper 5x5x2.7 Mtr & Belt Feeder",
      unitType: "BOTH",
      satuan: "unit",
      volume: 1,
      orderIndex: 1,
      markingCode: "HOP-01",
      bundleTag: "SHIP-HOP01",
      structureItems: [
        {
          name: "Hopper Bin Wall Structure 5x5x2.7m",
          qty: 1,
          satuan: "unit",
          orderIndex: 0,
          markingCode: "HOP01-STR-01",
          subItems: [
            { name: "Plat SS400 Tebal 8mm", qty: 12, satuan: "lbr", dimension: "5' x 20' x 8mm" },
            { name: "Stiffener Siku L 75x75x8 mm", qty: 18, satuan: "btg", dimension: "Pengaku Dinding Hopper" },
            { name: "Top Beam WF 250 x 125 mm", qty: 4, satuan: "btg", dimension: "Flange Frame Keliling" },
          ],
        },
        {
          name: "Main Support Leg WF 300 x 150 mm",
          qty: 4,
          satuan: "set",
          orderIndex: 1,
          markingCode: "HOP01-STR-02",
          subItems: [
            { name: "WF 300 x 150 x 6.5 x 9 mm", qty: 4, satuan: "btg", dimension: "H=5500mm" },
            { name: "Bracing WF 150 x 75 mm", qty: 8, satuan: "btg", dimension: "Cross Bracing Tiang" },
            { name: "Base Plate 25mm", qty: 4, satuan: "pcs", dimension: "Plat 25mm x 500 x 500" },
          ],
        },
      ],
      mechanicalItems: [
        {
          name: "Belt Feeder Drive System 7.5 kW",
          qty: 1,
          satuan: "set",
          orderIndex: 0,
          markingCode: "HOP01-MCH-01",
          subItems: [
            { name: "Motor Inverter 7.5 kW Variable Speed", qty: 1, satuan: "unit", spec: "VFD Duty" },
            { name: "Heavy Duty Shaft Mounted Reducer", qty: 1, satuan: "unit", spec: "High Torque" },
            { name: "Feeder Impact Idler Roller", qty: 12, satuan: "unit", spec: "Rubber Cushion Dia. 114" },
          ],
        },
      ],
    },
  ];

  for (const u of unitsData) {
    const createdUnit = await prisma.conveyorUnit.create({
      data: {
        projectId: project.id,
        name: u.name,
        unitType: u.unitType,
        satuan: u.satuan,
        volume: u.volume,
        orderIndex: u.orderIndex,
        markingCode: u.markingCode,
        bundleTag: u.bundleTag,
      },
    });

    console.log(`+ Conveyor Unit dibuat: "${createdUnit.name}" (ID: ${createdUnit.id})`);

    // Create Structure Items & Sub Items
    for (const s of u.structureItems) {
      const createdStr = await prisma.structureItem.create({
        data: {
          unitId: createdUnit.id,
          name: s.name,
          qty: s.qty,
          satuan: s.satuan,
          orderIndex: s.orderIndex,
          markingCode: s.markingCode,
        },
      });

      if (s.subItems && s.subItems.length > 0) {
        for (let i = 0; i < s.subItems.length; i++) {
          const sub = s.subItems[i];
          await prisma.structureSubItem.create({
            data: {
              structureItemId: createdStr.id,
              name: sub.name,
              qty: sub.qty,
              satuan: sub.satuan,
              dimension: sub.dimension,
              orderIndex: i,
            },
          });
        }
      }
      console.log(`  -> Komponen Struktur: "${createdStr.name}" (${s.subItems.length} sub-komponen)`);
    }

    // Create Mechanical Items & Sub Items
    for (const m of u.mechanicalItems) {
      const createdMech = await prisma.mechanicalItem.create({
        data: {
          unitId: createdUnit.id,
          name: m.name,
          qty: m.qty,
          satuan: m.satuan,
          orderIndex: m.orderIndex,
          markingCode: m.markingCode,
        },
      });

      if (m.subItems && m.subItems.length > 0) {
        for (let i = 0; i < m.subItems.length; i++) {
          const sub = m.subItems[i];
          await prisma.mechanicalSubItem.create({
            data: {
              mechanicalItemId: createdMech.id,
              name: sub.name,
              qty: sub.qty,
              satuan: sub.satuan,
              spec: sub.spec,
              orderIndex: i,
            },
          });
        }
      }
      console.log(`  -> Komponen Mekanikal: "${createdMech.name}" (${m.subItems.length} sub-komponen)`);
    }
  }

  // Jika masterplan sudah ada, perbarui totalWeeks menjadi 12 minggu
  if (project.masterplan) {
    console.log(`Memperbarui masterplan yang sudah ada: totalWeeks = ${totalWeeks}`);
    await prisma.masterplan.update({
      where: { id: project.masterplan.id },
      data: {
        totalWeeks: totalWeeks,
        startDate: startDate,
      },
    });

    // Sesuaikan endWeek pada phase yang melebihi 12 minggu
    const phases = await prisma.masterplanPhase.findMany({
      where: { masterplanId: project.masterplan.id },
    });

    for (const phase of phases) {
      const updatedStart = Math.min(phase.startWeek, totalWeeks);
      const updatedEnd = Math.min(phase.endWeek, totalWeeks);
      if (updatedStart !== phase.startWeek || updatedEnd !== phase.endWeek) {
        await prisma.masterplanPhase.update({
          where: { id: phase.id },
          data: {
            startWeek: updatedStart,
            endWeek: updatedEnd,
          },
        });
      }
    }

    // Perbarui atau recreate weekly plans s/d week 12
    await prisma.weeklyPlan.deleteMany({
      where: { masterplanId: project.masterplan.id },
    });

    for (let w = 1; w <= totalWeeks; w++) {
      const wStart = new Date(startDate);
      wStart.setDate(wStart.getDate() + (w - 1) * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wEnd.getDate() + 6);

      await prisma.weeklyPlan.create({
        data: {
          masterplanId: project.masterplan.id,
          weekNumber: w,
          weekStartDate: wStart,
          weekEndDate: wEnd,
          planCumulativePercent: Math.round((w / totalWeeks) * 100 * 100) / 100,
          planWeeklyPercent: Math.round((100 / totalWeeks) * 100) / 100,
          actualCumulativePercent: 0,
          actualWeeklyPercent: 0,
          variance: 0,
        },
      });
    }

    // Connect unit progress
    const allConveyors = await prisma.conveyorUnit.findMany({
      where: { projectId: project.id },
    });
    const fabPhase = phases.find((p) => p.code === "FABRICATION" || p.name.toUpperCase().includes("FABRIKASI"));
    if (fabPhase) {
      await prisma.unitProgress.deleteMany({
        where: { phaseId: fabPhase.id },
      });
      for (const cu of allConveyors) {
        await prisma.unitProgress.create({
          data: {
            phaseId: fabPhase.id,
            unitId: cu.id,
            weightPercent: 100 / allConveyors.length,
            actualPercent: 0,
          },
        });
      }
    }
  }

  console.log("=== SEEDING SELESAI DENGAN SUKSES ===");
}

main()
  .catch((e) => {
    console.error("Gagal melakukan seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
