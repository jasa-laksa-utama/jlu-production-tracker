"use client";

import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Search, ChevronLeft, ChevronRight, RefreshCw, RefreshCcw } from "lucide-react";
import { SPBSubstitutionCard } from "@/components/trackers/spb-substitution-card";

interface EngineeringSpbApprovalClientProps {
  initialSubstitutions: any[];
}

export function EngineeringSpbApprovalClient({
  initialSubstitutions,
}: EngineeringSpbApprovalClientProps) {
  const [substitutions] = useState(initialSubstitutions);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Filtered items
  const filteredItems = useMemo(() => {
    return substitutions.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const spbNo = (item.spb?.spbNumber || "").toLowerCase();
      const projName = (item.spb?.project?.projectName || "").toLowerCase();
      const custName = (item.spb?.project?.customer?.name || "").toLowerCase();
      const compName = (
        item.spb?.project?.customer?.company || ""
      ).toLowerCase();
      const itemName = (item.name || "").toLowerCase();

      return (
        spbNo.includes(q) ||
        projName.includes(q) ||
        custName.includes(q) ||
        compName.includes(q) ||
        itemName.includes(q)
      );
    });
  }, [substitutions, searchQuery]);

  // Group items by SPB / Project
  const spbGroups = useMemo(() => {
    const map: { [key: string]: { spb: any; project: any; items: any[] } } = {};

    filteredItems.forEach((item) => {
      const spbKey = item.spb?.id || item.spbId || "unassigned";
      if (!map[spbKey]) {
        map[spbKey] = {
          spb: item.spb || { spbNumber: "SPB" },
          project: item.spb?.project || { projectName: "Tanpa Proyek" },
          items: [],
        };
      }
      map[spbKey].items.push(item);
    });

    return Object.values(map);
  }, [filteredItems]);

  const totalPages = Math.ceil(spbGroups.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const paginatedSpbGroups = useMemo(() => {
    const start = (activePage - 1) * pageSize;
    return spbGroups.slice(start, start + pageSize);
  }, [spbGroups, activePage, pageSize]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* Control Bar: Search, Refresh & Pagination */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-card border border-border/60 p-3 sm:p-4 rounded-xl shadow-xs">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Cari No SPB, proyek, barang..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8 h-9 rounded-lg bg-muted/20 border border-border/60 text-xs focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="h-8 px-2.5 text-xs font-semibold rounded-xl cursor-pointer gap-1.5 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={activePage <= 1}
              className="h-7.5 w-7.5 rounded-lg cursor-pointer disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-[11px] font-semibold sm:text-xs">
              Halaman <span className="text-foreground">{activePage}</span> dari{" "}
              <span className="text-foreground">{totalPages}</span>
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={activePage >= totalPages}
              className="h-7.5 w-7.5 rounded-lg cursor-pointer disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Accordion Grouped List Content (SPB / Proyek Level) */}
      {paginatedSpbGroups.length === 0 ? (
        <Card className="rounded-xl border border-dashed border-border/60 bg-muted/10 p-6 text-center">
          <p className="text-xs sm:text-sm font-medium text-muted-foreground">
            Tidak ada pengajuan substitusi barang yang menunggu persetujuan Engineering saat ini.
          </p>
        </Card>
      ) : (
        <Accordion
          type="multiple"
          defaultValue={paginatedSpbGroups.map(
            (g, idx) => g.spb?.id || `group-spb-${idx}`,
          )}
          className="space-y-2.5"
        >
          {paginatedSpbGroups.map((group, idx) => {
            const globalIndex = (activePage - 1) * pageSize + idx + 1;
            const customerName = group.project?.customer?.name || "-";
            const companyName = group.project?.customer?.company || "-";

            return (
              <AccordionItem
                key={group.spb.id || idx}
                value={group.spb.id || `group-spb-${idx}`}
                className="border border-border/60 rounded-xl bg-card overflow-hidden shadow-2xs hover:border-primary/30 transition-all border-b-0"
              >
                <AccordionTrigger className="px-3.5 py-3 hover:bg-muted/10 hover:no-underline select-none">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-2 text-left gap-1.5 sm:gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs sm:text-sm font-bold text-muted-foreground shrink-0 min-w-4">
                        {globalIndex}.
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-primary">
                            {group.spb?.spbNumber || "SPB"}
                          </span>
                          <span className="text-muted-foreground/60">•</span>
                          <span className="text-xs font-semibold text-foreground">
                            {group.project?.projectName}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground font-normal mt-0.5 truncate">
                          Customer:{" "}
                          <span className="text-foreground font-medium">
                            {customerName}
                          </span>
                          {companyName !== "-" && (
                            <>
                              {" "}
                              • PT:{" "}
                              <span className="text-foreground font-medium">
                                {companyName}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-medium text-muted-foreground self-start sm:self-auto shrink-0 bg-muted/30 px-2 py-0.5 rounded-md border border-border/40">
                      {group.items.length} Barang Substitusi
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="border-t border-border/40 bg-muted/5 p-3 space-y-2.5 pb-3">
                  {group.items.map((item: any) => (
                    <Card
                      key={item.id}
                      className="rounded-lg border border-border/60 p-3 space-y-2 bg-background shadow-2xs"
                    >
                      <SPBSubstitutionCard
                        item={item}
                        index={globalIndex}
                        onUpdated={() => window.location.reload()}
                      />
                    </Card>
                  ))}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
