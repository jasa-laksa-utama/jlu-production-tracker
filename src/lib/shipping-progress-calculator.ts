import prisma from "@/lib/prisma";

export interface ShippingSubComponentInfo {
  id: string;
  name: string;
  markingCode: string | null;
  qty: number;
  satuan: string;
  dimensionOrSpec?: string | null;
  isCompleted?: boolean;
}

export interface ShippingPackageComponent {
  id: string;
  name: string;
  markingCode: string | null;
  qty: number;
  unit: string;
  material?: string | null;
  dimensions?: string | null;
  weight?: number | null;
  category?: "STRUCTURE" | "MECHANICAL" | "GENERAL";
  parentUnitName?: string | null;
  parentUnitMarkingCode?: string | null;
  subComponents: ShippingSubComponentInfo[];
}

export interface PackageShippingInfo {
  packageId: string;
  packageCode: string;
  lotNo: string;
  status: string; // READY_TO_SHIP, IN_DELIVERY, DELIVERED, RETUR
  packageType?: string | null;
  weight?: number | null;
  dimensions?: string | null;
  cubication?: number | null;
  shipmentId: string | null;
  suratJalanNo: string | null;
  deliveryDate: string | null;
  deliveryProofUrl?: string | null;
  driverName?: string | null;
  vehiclePlate?: string | null;
  destination?: string | null;
  progressPercent: number; // 0, 25, 60, 100
  itemsCount: number;
  unitId?: string | null;
  unitName?: string | null;
  unitMarkingCode?: string | null;
  components: ShippingPackageComponent[];
}

export interface UnitComponentShippingDetail {
  id: string;
  name: string;
  markingCode: string | null;
  qty: number;
  satuan: string;
  category: "STRUCTURE" | "MECHANICAL";
  shippingStatus: "NOT_SHIPPED" | "READY_TO_SHIP" | "IN_DELIVERY" | "DELIVERED" | "RETUR";
  progressPercent: number; // 0, 25, 60, 100
  packageCode: string | null;
  suratJalanNo: string | null;
}

export interface UnitShippingBreakdown {
  unitId: string;
  unitName: string;
  markingCode: string | null;
  bundleTag: string | null;
  totalComponents: number;
  deliveredComponents: number;
  inDeliveryComponents: number;
  readyToShipComponents: number;
  notShippedComponents: number;
  totalKoli: number;
  deliveredKoli: number;
  inDeliveryKoli: number;
  readyToShipKoli: number;
  returKoli: number;
  actualProgress: number; // 0 - 100%
  isFullyDelivered: boolean;
  components: UnitComponentShippingDetail[];
  packages: PackageShippingInfo[];
}

export interface ProjectShippingSummary {
  projectId: string;
  projectNumber?: string | null;
  projectName?: string | null;
  clientName?: string | null;
  totalUnits: number;
  fullyDeliveredUnits: number;
  phaseActualProgress: number; // 0 - 100%
  totalPackagesCount: number;
  deliveredPackagesCount: number;
  inDeliveryPackagesCount: number;
  readyToShipPackagesCount: number;
  returPackagesCount: number;
  allPackages: PackageShippingInfo[];
  units: UnitShippingBreakdown[];
  allShipments: Array<{
    id: string;
    suratJalanNo: string;
    deliveryDate: string;
    status: string;
    destination: string;
    packagesCount: number;
  }>;
}

/**
 * Nilai pembobotan progres status pengiriman per koli:
 * - READY_TO_SHIP: 25% (Barang sudah lolos PPIC, terkemas di koli, siap berangkat)
 * - IN_DELIVERY: 60% (Surat Jalan terbit, armada dalam perjalanan menuju site)
 * - DELIVERED: 100% (Barang telah tiba dan bukti delivery/tanda terima sah)
 * - RETUR / LAINNYA: 0%
 */
export function getPackageStatusScore(status: string): number {
  switch (status?.toUpperCase()) {
    case "DELIVERED":
      return 100;
    case "IN_DELIVERY":
      return 60;
    case "READY_TO_SHIP":
      return 25;
    default:
      return 0;
  }
}

/**
 * Menghitung detail breakdown progres shipping untuk seluruh unit conveyor dan koli/packing list dalam suatu project.
 */
export async function calculateProjectShippingBreakdown(
  projectId: string,
  cutoffDate?: Date
): Promise<ProjectShippingSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      customer: true,
      conveyorUnits: {
        orderBy: { orderIndex: "asc" },
        include: {
          structureItems: {
            orderBy: { orderIndex: "asc" },
            include: {
              subItems: {
                orderBy: { orderIndex: "asc" },
              },
            },
          },
          mechanicalItems: {
            orderBy: { orderIndex: "asc" },
            include: {
              subItems: {
                orderBy: { orderIndex: "asc" },
              },
            },
          },
        },
      },
      shipments: {
        include: {
          driver: true,
          vehicle: true,
          packages: {
            include: {
              project_components: true,
            },
          },
        },
        orderBy: { deliveryDate: "desc" },
      },
      shipmentPackages: {
        include: {
          project_components: true,
          shipment: {
            include: {
              driver: true,
              vehicle: true,
            },
          },
        },
        orderBy: [{ lotNo: "asc" }, { code: "asc" }],
      },
      masterplan: {
        include: {
          phases: {
            where: {
              OR: [
                { code: "SHIPMENT" },
                { name: { contains: "SHIPMENT", mode: "insensitive" } },
                { name: { contains: "PENGIRIMAN", mode: "insensitive" } },
              ],
            },
            include: {
              unitProgresses: true,
            },
          },
        },
      },
    },
  });

  if (!project) {
    throw new Error(`Project dengan ID ${projectId} tidak ditemukan.`);
  }

  const rawPackages = project.shipmentPackages || [];
  const conveyorUnits = project.conveyorUnits || [];

  // Filter paket berdasarkan cutoffDate jika diberikan
  const activePackages = cutoffDate
    ? rawPackages.filter((pkg) => {
        const pkgDate = pkg.updatedAt || pkg.createdAt;
        return new Date(pkgDate).getTime() <= cutoffDate.getTime();
      })
    : rawPackages;

  // Siapkan peta lookup komponen dan sub-komponen dari seluruh conveyor units
  const structureItemMap = new Map<string, any>();
  const mechanicalItemMap = new Map<string, any>();

  conveyorUnits.forEach((u) => {
    (u.structureItems || []).forEach((si: any) => {
      const itemData = {
        ...si,
        unitId: u.id,
        unitName: u.name,
        unitMarkingCode: u.markingCode,
      };
      if (si.markingCode) {
        structureItemMap.set(si.markingCode.trim().toUpperCase(), itemData);
      }
      if (si.name) {
        structureItemMap.set(si.name.trim().toUpperCase(), itemData);
      }
    });

    (u.mechanicalItems || []).forEach((mi: any) => {
      const itemData = {
        ...mi,
        unitId: u.id,
        unitName: u.name,
        unitMarkingCode: u.markingCode,
      };
      if (mi.markingCode) {
        mechanicalItemMap.set(mi.markingCode.trim().toUpperCase(), itemData);
      }
      if (mi.name) {
        mechanicalItemMap.set(mi.name.trim().toUpperCase(), itemData);
      }
    });
  });

  // Format seluruh koli menjadi PackageShippingInfo yang lengkap dengan breakdown komponen & sub-komponen
  const allFormattedPackages: PackageShippingInfo[] = activePackages.map((pkg) => {
    const sh = pkg.shipment;
    let effectiveStatus = pkg.status;
    if (sh) {
      if (sh.status === "DELIVERED") effectiveStatus = "DELIVERED";
      else if (sh.status === "IN_DELIVERY") effectiveStatus = "IN_DELIVERY";
      else if (sh.status === "READY_TO_SHIP") effectiveStatus = "READY_TO_SHIP";
    }

    const score = getPackageStatusScore(effectiveStatus);

    // Deteksi unit conveyor yang menaungi koli ini
    let matchedUnitId: string | null = null;
    let matchedUnitName: string | null = null;
    let matchedUnitMarkingCode: string | null = null;

    const pkgCode = (pkg.code || "").trim().toUpperCase();
    const pkgItemName = (pkg.itemName || "").trim().toUpperCase();
    const pkgItemCode = (pkg.itemCode || "").trim().toUpperCase();

    for (const u of conveyorUnits) {
      const uMarking = (u.markingCode || "").trim().toUpperCase();
      const uBundle = (u.bundleTag || "").trim().toUpperCase();
      const uName = (u.name || "").trim().toUpperCase();

      const isMatch =
        (uMarking && (pkgCode.includes(uMarking) || pkgItemName.includes(uMarking) || pkgItemCode === uMarking)) ||
        (uBundle && (pkgCode.includes(uBundle) || pkgItemName.includes(uBundle) || pkgItemCode === uBundle)) ||
        (uName && (pkgCode.includes(uName) || pkgItemName.includes(uName)));

      if (isMatch) {
        matchedUnitId = u.id;
        matchedUnitName = u.name;
        matchedUnitMarkingCode = u.markingCode;
        break;
      }
    }

    // Breakdown Komponen & Sub-Komponen
    const components: ShippingPackageComponent[] = [];
    const rawProjectComponents = pkg.project_components || [];

    if (rawProjectComponents.length > 0) {
      rawProjectComponents.forEach((pc: any) => {
        const pcMarking = (pc.markingCode || "").trim().toUpperCase();
        const pcName = (pc.name || "").trim().toUpperCase();

        const matchedStr =
          (pcMarking && structureItemMap.get(pcMarking)) ||
          (pcName && structureItemMap.get(pcName));
        const matchedMec =
          (pcMarking && mechanicalItemMap.get(pcMarking)) ||
          (pcName && mechanicalItemMap.get(pcName));

        const subComponents: ShippingSubComponentInfo[] = [];

        if (matchedStr?.subItems) {
          matchedStr.subItems.forEach((sub: any) => {
            subComponents.push({
              id: sub.id,
              name: sub.name,
              markingCode: sub.markingCode || matchedStr.markingCode || pc.markingCode,
              qty: sub.qty,
              satuan: sub.satuan,
              dimensionOrSpec: sub.dimension || null,
              isCompleted: sub.isCompleted,
            });
          });
          if (!matchedUnitName && matchedStr.unitName) {
            matchedUnitId = matchedStr.unitId;
            matchedUnitName = matchedStr.unitName;
            matchedUnitMarkingCode = matchedStr.unitMarkingCode;
          }
        } else if (matchedMec?.subItems) {
          matchedMec.subItems.forEach((sub: any) => {
            subComponents.push({
              id: sub.id,
              name: sub.name,
              markingCode: sub.markingCode || matchedMec.markingCode || pc.markingCode,
              qty: sub.qty,
              satuan: sub.satuan,
              dimensionOrSpec: sub.spec || null,
              isCompleted: sub.isCompleted,
            });
          });
          if (!matchedUnitName && matchedMec.unitName) {
            matchedUnitId = matchedMec.unitId;
            matchedUnitName = matchedMec.unitName;
            matchedUnitMarkingCode = matchedMec.unitMarkingCode;
          }
        }

        let compUnitName = matchedStr?.unitName || matchedMec?.unitName || null;
        let compUnitMarking = matchedStr?.unitMarkingCode || matchedMec?.unitMarkingCode || null;

        if (!compUnitName && pcMarking) {
          for (const u of conveyorUnits) {
            const uMark = (u.markingCode || "").trim().toUpperCase();
            if (uMark && (pcMarking === uMark || pcMarking.startsWith(uMark + "-") || pcMarking.startsWith(uMark + "/") || pcMarking.startsWith(uMark + " "))) {
              compUnitName = u.name;
              compUnitMarking = u.markingCode;
              break;
            }
          }
        }

        const dimensionsStr =
          pc.dimensionP || pc.dimensionL || pc.dimensionT
            ? `${pc.dimensionP || 0}×${pc.dimensionL || 0}×${pc.dimensionT || 0} mm`
            : null;

        components.push({
          id: pc.id,
          name: pc.name,
          markingCode: pc.markingCode || "-",
          qty: pc.qty || 1,
          unit: pc.unit || "PCS",
          material: pc.material || null,
          dimensions: dimensionsStr,
          weight: pc.weight || null,
          category: matchedStr ? "STRUCTURE" : matchedMec ? "MECHANICAL" : "GENERAL",
          parentUnitName: compUnitName || matchedUnitName || null,
          parentUnitMarkingCode: compUnitMarking || matchedUnitMarkingCode || null,
          subComponents,
        });
      });
    } else {
      // Periksa apakah itemName memuat format serialisasi JSON
      let parsedItems: any[] | null = null;
      try {
        const parsed = JSON.parse(pkg.itemName);
        if (Array.isArray(parsed)) parsedItems = parsed;
      } catch {}

      if (parsedItems && parsedItems.length > 0) {
        parsedItems.forEach((item: any, idx: number) => {
          const itemMarking = (item.markingCode || item.code || "").trim().toUpperCase();
          const itemName = (item.name || item.itemName || "").trim().toUpperCase();

          const matchedStr =
            (itemMarking && structureItemMap.get(itemMarking)) ||
            (itemName && structureItemMap.get(itemName));
          const matchedMec =
            (itemMarking && mechanicalItemMap.get(itemMarking)) ||
            (itemName && mechanicalItemMap.get(itemName));

          const subComponents: ShippingSubComponentInfo[] = [];
          if (matchedStr?.subItems) {
            matchedStr.subItems.forEach((sub: any) => {
              subComponents.push({
                id: sub.id,
                name: sub.name,
                markingCode: sub.markingCode || matchedStr.markingCode || item.markingCode,
                qty: sub.qty,
                satuan: sub.satuan,
                dimensionOrSpec: sub.dimension || null,
                isCompleted: sub.isCompleted,
              });
            });
            if (!matchedUnitName && matchedStr.unitName) {
              matchedUnitId = matchedStr.unitId;
              matchedUnitName = matchedStr.unitName;
              matchedUnitMarkingCode = matchedStr.unitMarkingCode;
            }
          } else if (matchedMec?.subItems) {
            matchedMec.subItems.forEach((sub: any) => {
              subComponents.push({
                id: sub.id,
                name: sub.name,
                markingCode: sub.markingCode || matchedMec.markingCode || item.markingCode,
                qty: sub.qty,
                satuan: sub.satuan,
                dimensionOrSpec: sub.spec || null,
                isCompleted: sub.isCompleted,
              });
            });
            if (!matchedUnitName && matchedMec.unitName) {
              matchedUnitId = matchedMec.unitId;
              matchedUnitName = matchedMec.unitName;
              matchedUnitMarkingCode = matchedMec.unitMarkingCode;
            }
          }

          let compUnitName = matchedStr?.unitName || matchedMec?.unitName || null;
          let compUnitMarking = matchedStr?.unitMarkingCode || matchedMec?.unitMarkingCode || null;

          if (!compUnitName && itemMarking) {
            for (const u of conveyorUnits) {
              const uMark = (u.markingCode || "").trim().toUpperCase();
              if (uMark && (itemMarking === uMark || itemMarking.startsWith(uMark + "-") || itemMarking.startsWith(uMark + "/") || itemMarking.startsWith(uMark + " "))) {
                compUnitName = u.name;
                compUnitMarking = u.markingCode;
                break;
              }
            }
          }

          components.push({
            id: `parsed-${pkg.id}-${idx}`,
            name: item.name || item.itemName || `Item #${idx + 1}`,
            markingCode: item.markingCode || item.code || "-",
            qty: item.qty || 1,
            unit: item.satuan || item.unit || "PCS",
            material: item.material || null,
            dimensions: item.dimensions || item.dimension || null,
            weight: item.weight || null,
            category: matchedStr ? "STRUCTURE" : matchedMec ? "MECHANICAL" : "GENERAL",
            parentUnitName: compUnitName || matchedUnitName || null,
            parentUnitMarkingCode: compUnitMarking || matchedUnitMarkingCode || null,
            subComponents,
          });
        });
      } else {
        // Fallback: satu item berdasarkan nama paket koli
        const singleMarking = (pkg.itemCode || "").trim().toUpperCase();
        const singleName = (pkg.itemName || "").trim().toUpperCase();

        const matchedStr =
          (singleMarking && structureItemMap.get(singleMarking)) ||
          (singleName && structureItemMap.get(singleName));
        const matchedMec =
          (singleMarking && mechanicalItemMap.get(singleMarking)) ||
          (singleName && mechanicalItemMap.get(singleName));

        const subComponents: ShippingSubComponentInfo[] = [];
        if (matchedStr?.subItems) {
          matchedStr.subItems.forEach((sub: any) => {
            subComponents.push({
              id: sub.id,
              name: sub.name,
              markingCode: sub.markingCode || matchedStr.markingCode,
              qty: sub.qty,
              satuan: sub.satuan,
              dimensionOrSpec: sub.dimension || null,
              isCompleted: sub.isCompleted,
            });
          });
          if (!matchedUnitName && matchedStr.unitName) {
            matchedUnitId = matchedStr.unitId;
            matchedUnitName = matchedStr.unitName;
            matchedUnitMarkingCode = matchedStr.unitMarkingCode;
          }
        } else if (matchedMec?.subItems) {
          matchedMec.subItems.forEach((sub: any) => {
            subComponents.push({
              id: sub.id,
              name: sub.name,
              markingCode: sub.markingCode || matchedMec.markingCode,
              qty: sub.qty,
              satuan: sub.satuan,
              dimensionOrSpec: sub.spec || null,
              isCompleted: sub.isCompleted,
            });
          });
          if (!matchedUnitName && matchedMec.unitName) {
            matchedUnitId = matchedMec.unitId;
            matchedUnitName = matchedMec.unitName;
            matchedUnitMarkingCode = matchedMec.unitMarkingCode;
          }
        }

        let compUnitName = matchedStr?.unitName || matchedMec?.unitName || null;
        let compUnitMarking = matchedStr?.unitMarkingCode || matchedMec?.unitMarkingCode || null;

        if (!compUnitName && singleMarking) {
          for (const u of conveyorUnits) {
            const uMark = (u.markingCode || "").trim().toUpperCase();
            if (uMark && (singleMarking === uMark || singleMarking.startsWith(uMark + "-") || singleMarking.startsWith(uMark + "/") || singleMarking.startsWith(uMark + " "))) {
              compUnitName = u.name;
              compUnitMarking = u.markingCode;
              break;
            }
          }
        }

        components.push({
          id: `pkg-item-${pkg.id}`,
          name: pkg.itemName,
          markingCode: pkg.itemCode || "-",
          qty: pkg.qty || 1,
          unit: pkg.unit || "PCS",
          material: null,
          dimensions: pkg.dimensions || null,
          weight: pkg.weight || null,
          category: matchedStr ? "STRUCTURE" : matchedMec ? "MECHANICAL" : "GENERAL",
          parentUnitName: compUnitName || matchedUnitName || null,
          parentUnitMarkingCode: compUnitMarking || matchedUnitMarkingCode || null,
          subComponents,
        });
      }
    }

    return {
      packageId: pkg.id,
      packageCode: pkg.code,
      lotNo: pkg.lotNo,
      status: effectiveStatus,
      packageType: pkg.packageType || "PALET",
      weight: pkg.weight,
      dimensions: pkg.dimensions,
      cubication: pkg.cubication,
      shipmentId: sh?.id || null,
      suratJalanNo: sh?.suratJalanNo || null,
      deliveryDate: sh?.deliveryDate ? new Date(sh.deliveryDate).toISOString() : null,
      deliveryProofUrl: sh?.deliveryProofUrl || null,
      driverName: sh?.driver?.name || sh?.driverName || null,
      vehiclePlate: sh?.vehicle?.plateNumber || sh?.vehiclePlateNumber || null,
      destination: sh?.destination || null,
      progressPercent: score,
      itemsCount: components.length > 0 ? components.length : 1,
      unitId: matchedUnitId,
      unitName: matchedUnitName,
      unitMarkingCode: matchedUnitMarkingCode,
      components,
    };
  });

  const unitBreakdowns: UnitShippingBreakdown[] = [];

  for (const unit of conveyorUnits) {
    const unitMarking = (unit.markingCode || "").trim().toUpperCase();
    const unitBundleTag = (unit.bundleTag || "").trim().toUpperCase();
    const unitName = (unit.name || "").trim().toUpperCase();

    // 1. Kumpulkan seluruh penanda komponen yang sah milik unit ini
    const unitComponentsList: UnitComponentShippingDetail[] = [];
    let totalScore = 0;
    let deliveredComponents = 0;
    let inDeliveryComponents = 0;
    let readyToShipComponents = 0;
    let notShippedComponents = 0;

    const checkItemShippingStatus = (
      itemName: string,
      itemMarking: string | null,
      category: "STRUCTURE" | "MECHANICAL",
      qty: number,
      satuan: string,
      id: string
    ) => {
      const cleanMark = (itemMarking || "").trim().toUpperCase();
      const cleanName = itemName.trim().toUpperCase();

      // Cari apakah komponen ini termuat di dalam salah satu koli
      let matchedPkg: PackageShippingInfo | null = null;

      for (const pkg of allFormattedPackages) {
        const found = pkg.components.some((c) => {
          const cMark = (c.markingCode || "").trim().toUpperCase();
          const cName = c.name.trim().toUpperCase();

          // 1. Jika keduanya memiliki markingCode, wajib identik
          if (cleanMark && cMark) {
            return cleanMark === cMark;
          }
          // 2. Jika komponen unit punya marking, tapi koli tidak -> tidak cocok
          if (cleanMark && !cMark) {
            return false;
          }
          // 3. Jika koli punya marking code, periksa kesesuaian unit marking prefix
          if (!cleanMark && cMark) {
            if (unitMarking && (cMark.startsWith(unitMarking + "-") || cMark.startsWith(unitMarking + "/"))) {
              return cleanName && cName && cleanName === cName;
            }
            return false;
          }
          // 4. Jika keduanya tidak punya marking, cocokkan nama
          return cleanName && cName && cleanName === cName;
        });

        if (found) {
          matchedPkg = pkg;
          break;
        }
      }

      let status: "NOT_SHIPPED" | "READY_TO_SHIP" | "IN_DELIVERY" | "DELIVERED" | "RETUR" = "NOT_SHIPPED";
      let progress = 0;

      if (matchedPkg) {
        if (matchedPkg.status === "DELIVERED") {
          status = "DELIVERED";
          progress = 100;
          deliveredComponents++;
        } else if (matchedPkg.status === "IN_DELIVERY") {
          status = "IN_DELIVERY";
          progress = 60;
          inDeliveryComponents++;
        } else if (matchedPkg.status === "READY_TO_SHIP") {
          status = "READY_TO_SHIP";
          progress = 25;
          readyToShipComponents++;
        } else if (matchedPkg.status === "RETUR") {
          status = "RETUR";
          progress = 0;
        }
      } else {
        notShippedComponents++;
      }

      totalScore += progress;

      unitComponentsList.push({
        id,
        name: itemName,
        markingCode: itemMarking,
        qty,
        satuan,
        category,
        shippingStatus: status,
        progressPercent: progress,
        packageCode: matchedPkg?.packageCode || null,
        suratJalanNo: matchedPkg?.suratJalanNo || null,
      });
    };

    unit.structureItems.forEach((si) => {
      checkItemShippingStatus(si.name, si.markingCode, "STRUCTURE", si.qty, si.satuan, si.id);
    });

    unit.mechanicalItems.forEach((mi) => {
      checkItemShippingStatus(mi.name, mi.markingCode, "MECHANICAL", mi.qty, mi.satuan, mi.id);
    });

    const totalComponents = unitComponentsList.length;

    // Progres Unit dihitung berdasarkan bobot progres seluruh komponen milik unit:
    const calculatedUnitProgress =
      totalComponents > 0
        ? Math.round((totalScore / totalComponents) * 100) / 100
        : 0;

    // 100% HANYA jika totalComponents > 0 dan SEMUA komponen berstatus DELIVERED
    const isFullyDelivered =
      totalComponents > 0 && deliveredComponents === totalComponents;

    // 2. Temukan koli yang memuat komponen milik unit ini, dan filter komponen koli KHUSUS milik unit ini
    const matchedPackagesForUnit: PackageShippingInfo[] = [];

    allFormattedPackages.forEach((pkg) => {
      const relevantComponents = pkg.components.filter((c) => {
        const cMark = (c.markingCode || "").trim().toUpperCase();
        const cName = c.name.trim().toUpperCase();

        return unitComponentsList.some((uc) => {
          const ucMark = (uc.markingCode || "").trim().toUpperCase();
          const ucName = uc.name.trim().toUpperCase();

          if (cMark && ucMark) return cMark === ucMark;
          if (cMark && !ucMark) {
            if (unitMarking && (cMark.startsWith(unitMarking + "-") || cMark.startsWith(unitMarking + "/"))) {
              return cName && ucName && cName === ucName;
            }
            return false;
          }
          if (!cMark && ucMark) return false;
          return cName && ucName && cName === ucName;
        });
      });

      if (relevantComponents.length > 0) {
        matchedPackagesForUnit.push({
          ...pkg,
          components: relevantComponents,
          itemsCount: relevantComponents.length,
        });
      }
    });

    const totalKoli = matchedPackagesForUnit.length;
    let deliveredKoli = 0;
    let inDeliveryKoli = 0;
    let readyToShipKoli = 0;
    let returKoli = 0;

    matchedPackagesForUnit.forEach((p) => {
      if (p.status === "DELIVERED") deliveredKoli++;
      else if (p.status === "IN_DELIVERY") inDeliveryKoli++;
      else if (p.status === "READY_TO_SHIP") readyToShipKoli++;
      else if (p.status === "RETUR") returKoli++;
    });

    unitBreakdowns.push({
      unitId: unit.id,
      unitName: unit.name,
      markingCode: unit.markingCode,
      bundleTag: unit.bundleTag,
      totalComponents,
      deliveredComponents,
      inDeliveryComponents,
      readyToShipComponents,
      notShippedComponents,
      totalKoli,
      deliveredKoli,
      inDeliveryKoli,
      readyToShipKoli,
      returKoli,
      actualProgress: calculatedUnitProgress,
      isFullyDelivered,
      components: unitComponentsList,
      packages: matchedPackagesForUnit,
    });
  }

  // Hitung total progres proyek untuk fase SHIPMENT
  const shipmentPhase = project.masterplan?.phases[0];
  let phaseActualProgress = 0;

  if (conveyorUnits.length > 0) {
    const hasCustomWeights = unitBreakdowns.some((ub) => {
      const up = shipmentPhase?.unitProgresses?.find((p) => p.unitId === ub.unitId);
      return up && Number(up.weightPercent) > 0;
    });

    let cumulativeProgress = 0;
    unitBreakdowns.forEach((ub) => {
      const up = shipmentPhase?.unitProgresses?.find((p) => p.unitId === ub.unitId);
      if (hasCustomWeights && up && Number(up.weightPercent) > 0) {
        cumulativeProgress += (ub.actualProgress * Number(up.weightPercent)) / 100;
      } else {
        const equalWeight = 100 / conveyorUnits.length;
        cumulativeProgress += (ub.actualProgress * equalWeight) / 100;
      }
    });

    phaseActualProgress = Math.min(100, Math.max(0, Math.round(cumulativeProgress * 100) / 100));
  }

  // Pastikan: 100% hanya tercapai jika SEMUA unit yang ada berstatus isFullyDelivered
  const allUnitsFullyDelivered =
    unitBreakdowns.length > 0 && unitBreakdowns.every((u) => u.isFullyDelivered);

  if (phaseActualProgress >= 100 && !allUnitsFullyDelivered) {
    phaseActualProgress = 99.9; // Cegah 100% semu jika masih ada barang / unit yang belum sampai
  } else if (allUnitsFullyDelivered) {
    phaseActualProgress = 100;
  }

  const allShipmentsSummary = (project.shipments || []).map((s) => ({
    id: s.id,
    suratJalanNo: s.suratJalanNo || "-",
    deliveryDate: s.deliveryDate ? new Date(s.deliveryDate).toISOString() : "-",
    status: s.status,
    destination: s.destination,
    packagesCount: s.packages.length,
  }));

  // Hitung statistik koli di level proyek
  let projectDeliveredPackages = 0;
  let projectInDeliveryPackages = 0;
  let projectReadyToShipPackages = 0;
  let projectReturPackages = 0;

  allFormattedPackages.forEach((pkg) => {
    if (pkg.status === "DELIVERED") projectDeliveredPackages++;
    else if (pkg.status === "IN_DELIVERY") projectInDeliveryPackages++;
    else if (pkg.status === "READY_TO_SHIP") projectReadyToShipPackages++;
    else if (pkg.status === "RETUR") projectReturPackages++;
  });

  const clientName =
    project.customer?.company || project.customer?.name || null;

  return {
    projectId,
    projectNumber: project.projectNumber || null,
    projectName: project.projectName || null,
    clientName,
    totalUnits: conveyorUnits.length,
    fullyDeliveredUnits: unitBreakdowns.filter((u) => u.isFullyDelivered).length,
    phaseActualProgress,
    totalPackagesCount: allFormattedPackages.length,
    deliveredPackagesCount: projectDeliveredPackages,
    inDeliveryPackagesCount: projectInDeliveryPackages,
    readyToShipPackagesCount: projectReadyToShipPackages,
    returPackagesCount: projectReturPackages,
    allPackages: allFormattedPackages,
    units: unitBreakdowns,
    allShipments: allShipmentsSummary,
  };
}

/**
 * Mengalkulasi ulang dan menyinkronkan progress pengiriman unit ke UnitProgress,
 * MasterplanPhase (SHIPMENT), dan WeeklyPlan snapshot.
 */
export async function recalculateProjectShippingProgress(projectId: string) {
  try {
    const summary = await calculateProjectShippingBreakdown(projectId);

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        masterplan: {
          include: {
            phases: {
              where: {
                OR: [
                  { code: "SHIPMENT" },
                  { name: { contains: "SHIPMENT", mode: "insensitive" } },
                  { name: { contains: "PENGIRIMAN", mode: "insensitive" } },
                ],
              },
            },
          },
        },
      },
    });

    const masterplan = project?.masterplan;
    const shipmentPhase = masterplan?.phases[0];

    if (!masterplan || !shipmentPhase) {
      return summary;
    }

    // Update UnitProgress per unit conveyor untuk fase SHIPMENT
    for (const unit of summary.units) {
      await prisma.unitProgress.upsert({
        where: {
          phaseId_unitId: {
            phaseId: shipmentPhase.id,
            unitId: unit.unitId,
          },
        },
        create: {
          phaseId: shipmentPhase.id,
          unitId: unit.unitId,
          weightPercent: 0,
          actualPercent: unit.actualProgress,
        },
        update: {
          actualPercent: unit.actualProgress,
        },
      });
    }

    // Update progress fase SHIPMENT
    const cleanProgress = summary.phaseActualProgress;
    const newStatus =
      cleanProgress >= 100
        ? "COMPLETED"
        : cleanProgress > 0
        ? "IN_PROGRESS"
        : "NOT_STARTED";

    await prisma.masterplanPhase.update({
      where: { id: shipmentPhase.id },
      data: {
        actualProgress: cleanProgress,
        status: newStatus,
      },
    });

    // Sinkronisasi S-Curve mingguan Masterplan
    const { syncMasterplanWeeklySnapshot } = await import("@/app/actions/masterplan");
    await syncMasterplanWeeklySnapshot(masterplan.id);

    return summary;
  } catch (err) {
    console.error("Error recalculating project shipping progress:", err);
    throw err;
  }
}
