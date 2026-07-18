"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Calendar,
  Users,
  Layers,
  Layout,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { setupProjectMasterplan } from "@/app/actions/masterplan";
import { DEFAULT_CONVEYOR_PHASES } from "@/lib/progress-weights";

export function MasterplanSetup({
  project,
  onSuccess,
}: {
  project: any;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("general");

  // State configurations
  const [totalWeeks, setTotalWeeks] = useState<number>(() => {
    if (project.masterplan?.totalWeeks) {
      return project.masterplan.totalWeeks;
    }
    return 30;
  });

  const [startDate, setStartDate] = useState<string>(() => {
    if (project.masterplan?.startDate) {
      try {
        return new Date(project.masterplan.startDate).toISOString().split("T")[0];
      } catch (e) {
        return new Date().toISOString().split("T")[0];
      }
    }
    return new Date().toISOString().split("T")[0];
  });

  // Leaders state
  const [leaders, setLeaders] = useState<Array<{ divisionName: string; leaderName: string }>>(() => {
    if (project.masterplan?.divisionLeaders && project.masterplan.divisionLeaders.length > 0) {
      return project.masterplan.divisionLeaders.map((dl: any) => ({
        divisionName: dl.divisionName,
        leaderName: dl.leaderName,
      }));
    }
    return [{ divisionName: "", leaderName: "" }];
  });

  // Phases state (initialize with existing or default values)
  const [phases, setPhases] = useState<any[]>(() => {
    if (project.masterplan?.phases && project.masterplan.phases.length > 0) {
      return project.masterplan.phases.map((p: any) => ({
        code: p.code,
        name: p.name,
        weightPercent: Number(p.weightPercent || 0),
        startWeek: p.startWeek,
        endWeek: p.endWeek,
        orderIndex: p.orderIndex,
        subSteps: p.subSteps || ([] as string[]),
      }));
    }
    return DEFAULT_CONVEYOR_PHASES.map((p) => ({
      code: p.code,
      name: p.name,
      weightPercent: p.weight,
      startWeek: p.startWeek,
      endWeek: p.endWeek,
      orderIndex: p.orderIndex,
      subSteps:
        p.code === "SHIPMENT"
          ? ["Packing & Loading", "Transit & Delivery", "Received at Site"]
          : p.code === "ERECTION"
            ? [
                "Foundation Alignment",
                "Frame Assembly",
                "Belt & Roller Installation",
                "Drive Unit Installation",
              ]
            : p.code === "COMMISSIONING"
              ? [
                  "Dry Run Test (no load)",
                  "Wet Run Test (loaded)",
                  "Client Acceptance & Signoff",
                ]
              : ([] as string[]),
    }));
  });

  // Units state (default loaded with existing or empty conveyor unit)
  const [units, setUnits] = useState<any[]>(() => {
    if (project.conveyorUnits && project.conveyorUnits.length > 0) {
      return project.conveyorUnits.map((u: any) => ({
        name: u.name,
        unitType: u.unitType,
        satuan: u.satuan || "unit",
        volume: u.volume || 1,
        structureItems: u.structureItems ? u.structureItems.map((si: any) => si.name) : [],
        mechanicalItems: u.mechanicalItems ? u.mechanicalItems.map((mi: any) => mi.name) : [],
      }));
    }
    return [
      {
        name: "",
        unitType: "BOTH",
        satuan: "unit",
        volume: 1,
        structureItems: [] as string[],
        mechanicalItems: [] as string[],
      },
    ];
  });

  // Helper to add conveyor unit
  const addUnit = () => {
    setUnits([
      ...units,
      {
        name: "",
        unitType: "BOTH",
        satuan: "unit",
        volume: 1,
        structureItems: [] as string[],
        mechanicalItems: [] as string[],
      },
    ]);
  };

  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  const MANDATORY_CODES = ["PROCUREMENT", "ENGINEERING", "FAB_STRUCT_MECH"];

  const addLeader = () => {
    setLeaders([...leaders, { divisionName: "", leaderName: "" }]);
  };

  const removeLeader = (index: number) => {
    setLeaders(leaders.filter((_, i) => i !== index));
  };

  const addPhase = () => {
    const newIdx = phases.length + 1;
    setPhases([
      ...phases,
      {
        code: `CUSTOM_PHASE_${Date.now()}`,
        name: `Tahapan Baru ${newIdx}`,
        weightPercent: 0,
        startWeek: 1,
        endWeek: totalWeeks,
        orderIndex: newIdx,
        subSteps: [] as string[],
      },
    ]);
  };

  const removePhase = (index: number) => {
    const updated = phases.filter((_, i) => i !== index);
    const adjusted = updated.map((p, idx) => ({ ...p, orderIndex: idx + 1 }));
    setPhases(adjusted);
  };

  const updateUnitField = (index: number, field: string, value: any) => {
    const updated = [...units];
    updated[index][field] = value;
    setUnits(updated);
  };

  // Submit Handler
  const handleSubmit = () => {
    const totalWeight = phases.reduce(
      (sum, p) => sum + Number(p.weightPercent),
      0,
    );
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast.error(
        `Total bobot tahapan harus tepat 100.00%. Saat ini: ${totalWeight.toFixed(2)}%`,
      );
      return;
    }

    startTransition(async () => {
      const res = await setupProjectMasterplan({
        projectId: project.id,
        totalWeeks,
        startDate: new Date(startDate),
        leaders,
        phases,
        units,
      });

      if (res.success) {
        toast.success("Masterplan berhasil diinisialisasi untuk produksi!");
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menginisialisasi masterplan");
      }
    });
  };

  return (
    <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-md w-full overflow-hidden rounded-2xl pt-0 pr-0">
      <CardHeader className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-6 px-6 pb-6 border-b border-border/20 rounded-t-2xl">
        <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>Inisialisasi Produksi</span>
        </div>
        <CardTitle className="text-2xl font-bold">
          Setup Masterplan Proyek
        </CardTitle>
        <CardDescription className="text-muted-foreground/80">
          Atur rencana produksi untuk proyek{" "}
          <strong>{project.projectName}</strong>.
        </CardDescription>
      </CardHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="px-6 bg-muted/20 border-b border-border/40 py-2">
          <TabsList className="grid grid-cols-4 bg-muted/40 p-1 rounded-xl h-10 w-full max-w-2xl">
            <TabsTrigger
              value="general"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" /> Jadwal
            </TabsTrigger>
            <TabsTrigger
              value="leaders"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" /> Tim Leader
            </TabsTrigger>
            <TabsTrigger
              value="phases"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" /> Bobot Tahap
            </TabsTrigger>
            <TabsTrigger
              value="units"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Layout className="w-3.5 h-3.5" /> Unit Conveyor
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: General Info */}
        <TabsContent
          value="general"
          className="p-6 m-0 space-y-6 animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Pengisian Jadwal:
              </strong>
              <p className="text-muted-foreground text-[12px]">
                Tentukan total rentang durasi keseluruhan proyek (dalam minggu)
                serta tanggal dimulainya minggu ke-1.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Total Durasi Proyek (Minggu)
              </Label>
              <Input
                type="number"
                min={1}
                max={52}
                value={totalWeeks}
                onChange={(e) => setTotalWeeks(Number(e.target.value))}
                className="rounded-xl border-border/80 h-10 shadow-none bg-background/50 focus:bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Jumlah minggu berjalan pada master schedule.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">
                Tanggal Mulai Proyek
              </Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border-border/80 h-10 shadow-none bg-background/50 focus:bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Hari pertama dimulainya progress minggu ke-1.
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Division Leaders */}
        <TabsContent
          value="leaders"
          className="p-6 m-0 space-y-4 animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Pengisian Tim Leader:
              </strong>
              <p className="text-muted-foreground text-[12px]">
                Tentukan nama Leader untuk masing-masing divisi/bagian utama
                proyek. Klik tombol <strong>+ Tambah Tim Leader</strong> untuk
                menambah Leader Divisi.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/10 p-3 rounded-xl border border-border/40">
              <span className="text-sm font-semibold text-foreground">
                Daftar Penanggung Jawab Divisi
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLeader}
                className="text-xs flex items-center gap-1.5 h-8 cursor-pointer rounded-lg font-semibold border-primary/20 hover:bg-primary/5 text-primary"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Tim Leader
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaders.map((leader, idx) => (
                <div
                  key={idx}
                  className="space-y-3 border border-border/50 p-4 rounded-xl bg-background/40 backdrop-blur-sm relative group/leader"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLeader(idx)}
                    className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/5 rounded-lg transition-opacity cursor-pointer"
                    title="Hapus Tim Leader"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">
                      Bagian / Divisi
                    </Label>
                    <Input
                      type="text"
                      placeholder="E.g. PROCUREMENT, CIVIL, ERECTION"
                      value={leader.divisionName}
                      onChange={(e) => {
                        const updated = [...leaders];
                        updated[idx].divisionName = e.target.value;
                        setLeaders(updated);
                      }}
                      className="rounded-lg h-9 bg-background/50 focus:bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">
                      Nama Leader
                    </Label>
                    <Input
                      type="text"
                      placeholder="Nama Penanggung Jawab"
                      value={leader.leaderName}
                      onChange={(e) => {
                        const updated = [...leaders];
                        updated[idx].leaderName = e.target.value;
                        setLeaders(updated);
                      }}
                      className="rounded-lg h-9 bg-background/50 focus:bg-background"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Phases Weights */}
        <TabsContent
          value="phases"
          className="p-6 m-0 space-y-4 max-h-[450px] overflow-y-auto animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Bobot & Jadwal Tahapan:
              </strong>
              <p className="text-muted-foreground text-[12px] whitespace-pre-wrap">
                Tentukan persentase bobot tiap tahapan (akumulasi total wajib
                tepat 100%). Batasi rentang jadwal pengerjaan tiap tahapan lewat
                nomor minggu mulai (Wk Mulai) dan minggu selesai (Wk Akhir).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/10 p-3 rounded-xl border border-border/40">
              <span className="text-sm font-semibold text-foreground">
                Bobot & Jadwal Proyek per Tahapan
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhase}
                className="text-xs flex items-center gap-1.5 h-8 cursor-pointer rounded-lg font-semibold border-primary/20 hover:bg-primary/5 text-primary"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Tahapan
              </Button>
            </div>

            <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-sm text-foreground border-b border-border/50">
                  <tr>
                    <th className="p-3 font-semibold">Nama Tahapan</th>
                    <th className="p-3 w-32 text-center font-semibold">
                      Bobot (%)
                    </th>
                    <th className="p-3 w-24 text-center font-semibold">
                      Wk Mulai
                    </th>
                    <th className="p-3 w-24 text-center font-semibold">
                      Wk Akhir
                    </th>
                    <th className="p-3 w-20 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-background/30">
                  {phases.map((phase, idx) => {
                    const isMandatory = MANDATORY_CODES.includes(phase.code);
                    return (
                      <tr
                        key={phase.code}
                        className="hover:bg-muted/10 transition-colors"
                      >
                        <td className="p-3">
                          {isMandatory ? (
                            <span className="font-semibold text-foreground text-xs pl-1.5">
                              {phase.name}
                            </span>
                          ) : (
                            <Input
                              type="text"
                              placeholder="Nama Tahapan Custom"
                              value={phase.name}
                              onChange={(e) => {
                                const updated = [...phases];
                                updated[idx].name = e.target.value;
                                updated[idx].code = e.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9]/g, "_");
                                setPhases(updated);
                              }}
                              className="h-8 rounded-lg text-xs bg-background/50 font-semibold border-border/80"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={phase.weightPercent}
                            onChange={(e) => {
                              const updated = [...phases];
                              updated[idx].weightPercent = Number(
                                e.target.value,
                              );
                              setPhases(updated);
                            }}
                            className="h-8 rounded-lg text-center font-semibold text-xs border-border/80"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={phase.startWeek}
                            onChange={(e) => {
                              const updated = [...phases];
                              updated[idx].startWeek = Number(e.target.value);
                              setPhases(updated);
                            }}
                            className="h-8 rounded-lg text-center text-xs border-border/80"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={phase.endWeek}
                            onChange={(e) => {
                              const updated = [...phases];
                              updated[idx].endWeek = Number(e.target.value);
                              setPhases(updated);
                            }}
                            className="h-8 rounded-lg text-center text-xs border-border/80"
                          />
                        </td>
                        <td className="p-3 text-center">
                          {isMandatory ? (
                            <span className="text-[9px] text-muted-foreground/60 font-black tracking-wider uppercase bg-muted border px-1.5 py-0.5 rounded">
                              Wajib
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePhase(idx)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/5 rounded-lg cursor-pointer"
                              title="Hapus Tahapan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
              <span className="text-sm font-semibold text-primary/80">
                Total Kumulatif Bobot:
              </span>
              <span
                className={`text-lg font-bold ${Math.abs(phases.reduce((sum, p) => sum + p.weightPercent, 0) - 100) < 0.01 ? "text-green-600" : "text-destructive"}`}
              >
                {phases.reduce((sum, p) => sum + p.weightPercent, 0).toFixed(2)}{" "}
                % / 100%
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Conveyor Units */}
        <TabsContent
          value="units"
          className="p-6 m-0 space-y-4 max-h-[450px] overflow-y-auto animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs animate-in fade-in duration-200">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Pengisian Unit Conveyor:
              </strong>
              <p className="text-muted-foreground text-[12px]">
                Daftarkan unit conveyor yang akan diproduksi. Tuliskan item
                checklist Struktur (rangka rangka) dan Mekanikal
                (motor/roller/pulley) untuk melacak progress di lapangan.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {units.map((unit, idx) => (
              <div
                key={idx}
                className="border border-border/50 rounded-xl p-4 bg-background/30 space-y-3 relative group"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeUnit(idx)}
                  className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/5 rounded-lg cursor-pointer transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Nama Unit Conveyor
                    </Label>
                    <Input
                      type="text"
                      placeholder="Contoh: Belt Conveyor BC 01 - BW 1.2 x L.58 mtr atau Room Hopper 5x5x2.7 mtr"
                      value={unit.name}
                      onChange={(e) =>
                        updateUnitField(idx, "name", e.target.value)
                      }
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Jenis Progress
                    </Label>
                    <select
                      value={unit.unitType}
                      onChange={(e) =>
                        updateUnitField(idx, "unitType", e.target.value)
                      }
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-none focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="BOTH">Structure & Mechanical</option>
                      <option value="STRUCTURE">Structure Only</option>
                      <option value="MECHANICAL">Mechanical Only</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addUnit}
              className="w-full h-9 border-dashed border-border/80 hover:bg-primary/5 hover:text-primary gap-1.5 rounded-xl font-semibold text-xs cursor-pointer shadow-none"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Unit Conveyor Baru
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <CardFooter className="bg-muted/10 border-t border-border/40 py-4 px-6 flex justify-between">
        {activeTab !== "general" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "leaders") setActiveTab("general");
              else if (activeTab === "phases") setActiveTab("leaders");
              else if (activeTab === "units") setActiveTab("phases");
            }}
            className="h-9 rounded-xl px-4 text-xs font-semibold gap-1.5 cursor-pointer shadow-none"
          >
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </Button>
        ) : (
          <div />
        )}

        {activeTab !== "units" ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              if (activeTab === "general") setActiveTab("leaders");
              else if (activeTab === "leaders") setActiveTab("phases");
              else if (activeTab === "phases") setActiveTab("units");
            }}
            className="h-9 rounded-xl px-4 text-xs font-semibold gap-1.5 cursor-pointer shadow-none"
          >
            Berikutnya <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={isPending}
            onClick={handleSubmit}
            className="h-9 rounded-xl px-5 text-xs font-bold gap-1.5 bg-linear-to-r from-primary to-primary/80 hover:opacity-95 text-primary-foreground cursor-pointer transition-all active:scale-95 shadow-md"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                Menginisialisasi...
              </>
            ) : (
              <>
                <span>Mulai Produksi</span>
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
