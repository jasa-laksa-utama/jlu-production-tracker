function getUniqueDocs(project: any) {
  const allRawDocs = [
    ...(project?.documents || []),
    ...(project?.lead?.documents || []),
  ];
  const docsMap = new Map();
  allRawDocs.forEach((d: any) => {
    if (!d) return;
    const key = d.id || `${d.category}_${d.fileName || d.name}_${d.version}`;
    if (!docsMap.has(key)) {
      docsMap.set(key, d);
    }
  });
  return Array.from(docsMap.values());
}

export function checkEngineeringPrerequisitesLocal(project: any) {
  const docs = getUniqueDocs(project);

  // 1. Drawing Document check (min. 1)
  const hasDrawing = docs.some((d: any) => {
    const cat = (d.category || "").toUpperCase();
    const label = (d.label || "").toUpperCase();
    const name = (d.fileName || d.name || "").toUpperCase();
    return (
      cat.includes("DRAWING") ||
      cat.includes("DESAIN") ||
      label.includes("DRAWING") ||
      name.includes("DRAWING") ||
      name.endsWith(".DWG") ||
      name.endsWith(".DXF") ||
      name.endsWith(".STEP") ||
      name.endsWith(".STP")
    );
  });

  // 2. BoQ check (min. 1 BoQ with items)
  const hasBoq =
    project?.boqs &&
    project.boqs.some((b: any) => (b.boqItems?.length || 0) > 0);

  // 3. Mechanical Part List Document check (min. 1)
  const hasPartList = docs.some((d: any) => {
    const cat = (d.category || "").toUpperCase();
    const label = (d.label || "").toUpperCase();
    const name = (d.fileName || d.name || "").toUpperCase();
    return (
      cat.includes("PART_LIST") ||
      cat.includes("MECH_PART_LIST") ||
      label.includes("PART LIST") ||
      label.includes("PART_LIST") ||
      name.includes("PART LIST") ||
      name.includes("PART_LIST") ||
      name.includes("PARTLIST")
    );
  });

  const missingItems: string[] = [];
  if (!hasDrawing) missingItems.push("Dokumen Drawing (min. 1)");
  if (!hasBoq) missingItems.push("BoQ dengan komponen (min. 1)");
  if (!hasPartList) missingItems.push("Dokumen Mechanical Part List (min. 1)");

  return {
    canCreateMasterplan: Boolean(hasDrawing && hasBoq && hasPartList),
    hasDrawing: Boolean(hasDrawing),
    hasBoq: Boolean(hasBoq),
    hasPartList: Boolean(hasPartList),
    missingItems,
  };
}

export function calculateEngineeringProgress(project: any) {
  const docs = getUniqueDocs(project);

  // Count drawing documents
  const drawingDocs = docs.filter((d: any) => {
    const cat = (d.category || "").toUpperCase();
    const label = (d.label || "").toUpperCase();
    const fileName = (d.fileName || d.name || "").toUpperCase();
    return (
      cat.includes("DRAWING") ||
      cat.includes("DESAIN") ||
      label.includes("DRAWING") ||
      fileName.includes("DRAWING") ||
      fileName.endsWith(".DWG") ||
      fileName.endsWith(".DXF") ||
      fileName.endsWith(".STEP") ||
      fileName.endsWith(".STP")
    );
  });

  const drawingCount = drawingDocs.length;
  const latestBoQ = project?.boqs && project.boqs.length > 0 ? project.boqs[0] : null;
  const boqCount = project?.boqs ? project.boqs.length : 0;
  const totalBoqItemCount = project?.boqs
    ? project.boqs.reduce((acc: number, b: any) => acc + (b.boqItems?.length || 0), 0)
    : 0;
  const latestBoqItemCount = latestBoQ?.boqItems ? latestBoQ.boqItems.length : 0;
  const boqItemCount = totalBoqItemCount;
  const boqStatus = latestBoQ?.boqStatus || "NONE";
  const boqNumber = latestBoQ?.boqNumber || null;

  // --- Tonase Calculations ---
  const estimatedTonnage = Number(
    project?.estimatedTonnage || project?.lead?.estimatedTonnage || 0
  );

  // Sum total tonnage from all uploaded drawing documents
  const drawingTonnage = drawingDocs.reduce(
    (sum: number, d: any) => sum + (Number(d.tonnage) || 0),
    0
  );

  // Sum approved BoQ tonnage
  const approvedBoqs = (project?.boqs || []).filter(
    (b: any) => b.boqStatus === "APPROVED"
  );

  const boqTonnage = approvedBoqs.reduce((sum: number, b: any) => {
    const bTon = Number(b.totalTonnage || 0);
    if (bTon > 0) return sum + bTon;
    const itemsTon = (b.boqItems || []).reduce(
      (iSum: number, item: any) => iSum + (Number(item.weightTon) || 0),
      0
    );
    return sum + itemsTon;
  }, 0);

  const masterplanEngPhase = project?.masterplan?.phases?.find(
    (p: any) => p.code === "ENGINEERING" || (p.name || "").toUpperCase().includes("ENG")
  );

  let calculatedProgress = 0;

  if (estimatedTonnage > 0) {
    // Formula berbasis Tonase (Bobot: 50% Drawing, 50% BoQ)
    let drawingPartPercent = Math.min(100, (drawingTonnage / estimatedTonnage) * 100);
    let boqPartPercent = Math.min(100, (boqTonnage / estimatedTonnage) * 100);

    // Fallback bonus kecil jika dokumen terupload tapi tonase belum diisi per berkas
    if (drawingCount > 0 && drawingTonnage === 0) {
      drawingPartPercent = 40; // 40% of Drawing deliverable (20% of total)
    }
    if (approvedBoqs.length > 0 && boqTonnage === 0) {
      boqPartPercent = 100; // 100% of BoQ deliverable (50% of total) if approved without explicit weightTon
    } else if (boqStatus === "PENDING_APPROVAL" && boqTonnage === 0) {
      boqPartPercent = 60;
    } else if (boqItemCount > 0 && boqTonnage === 0) {
      boqPartPercent = 30;
    }

    calculatedProgress = (drawingPartPercent * 0.5) + (boqPartPercent * 0.5);
  } else {
    // Fallback formula berbasis status milestone (jika estimasi tonase belum diisi)
    if (boqStatus === "APPROVED" && drawingCount > 0) {
      calculatedProgress = 100;
    } else if (boqStatus === "APPROVED") {
      calculatedProgress = 80;
    } else if (boqStatus === "PENDING_APPROVAL") {
      calculatedProgress = 60;
    } else if (boqItemCount > 0 || drawingCount > 0) {
      calculatedProgress = drawingCount > 0 && boqItemCount > 0 ? 50 : 30;
    } else {
      calculatedProgress = 0;
    }
  }

  const finalProgress = masterplanEngPhase
    ? Math.max(calculatedProgress, Number(masterplanEngPhase.actualProgress || 0))
    : calculatedProgress;

  return {
    engProgress: Math.min(100, Math.round(finalProgress)),
    drawingCount,
    boqCount,
    boqItemCount,
    totalBoqItemCount,
    latestBoqItemCount,
    boqStatus,
    boqNumber,
    isBoqApproved: boqStatus === "APPROVED",
    // Field Tonase
    estimatedTonnage,
    drawingTonnage,
    boqTonnage,
    isTonnageBased: estimatedTonnage > 0,
  };
}
