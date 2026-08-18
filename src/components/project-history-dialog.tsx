"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { History, Clock } from "lucide-react";
import { formatJakartaDate } from "@/lib/date-utils";

interface ProjectHistoryDialogProps {
  project: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectHistoryDialog({
  project,
  open,
  onOpenChange,
}: ProjectHistoryDialogProps) {
  if (!project) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-112.5 max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Project History Timestamps
          </DialogTitle>
          <DialogDescription>
            Detailed audit trail for <b>{project?.projectName}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 mt-4">
          <div className="relative pl-6 flex flex-col-reverse gap-y-6 before:absolute before:left-2.75 before:top-2 before:bottom-2 before:w-0.5 before:bg-muted-foreground/20">
            {/* Lead Entry (Initial Start) at the BOTTOM */}
            {project?.lead?.createdAt && (
              <div className="relative group">
                <div className="absolute -left-5.75 top-1.5 w-4 h-4 rounded-full border-2 border-background bg-amber-500 z-10" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-600">
                      LEADS (INITIAL ENTRY)
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                      {formatJakartaDate(project.lead.createdAt, "datetime")}
                    </span>
                  </div>
                  <div className="bg-amber-500/5 rounded-lg p-2 border border-amber-200/50">
                    <p className="text-xs font-semibold text-amber-700/80 mb-1">
                      Status: NEW LEAD
                    </p>
                    <p className="text-[11px] text-muted-foreground italic">
                      "Project first registered in CRM/Leads system."
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Lead Deal (Transition to Project) */}
            {project?.startDate && (
              <div className="relative group">
                <div className="absolute -left-5.75 top-1.5 w-4 h-4 rounded-full border-2 border-background bg-green-500 z-10" />
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-green-600">
                      LEAD DEAL (PROJECT START)
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                      {formatJakartaDate(project.startDate, "datetime")}
                    </span>
                  </div>
                  <div className="bg-green-500/5 rounded-lg p-2 border border-green-200/50">
                    <p className="text-xs font-semibold text-green-700/80 mb-1">
                      Status: CONVERTED TO PROJECT
                    </p>
                    <p className="text-[11px] text-muted-foreground italic">
                      "Sales journey completed. Project officially started in Production Pipeline."
                    </p>
                  </div>
                </div>
              </div>
            )}

            {project?.history?.length > 0 ? (
              [...project.history]
                .sort(
                  (a: any, b: any) =>
                    new Date(a.entryDate).getTime() -
                    new Date(b.entryDate).getTime(),
                )
                .map((entry: any, i: number) => (
                  <div key={entry.id} className="relative group">
                    {/* Timeline Dot */}
                    <div className="absolute -left-5.75 top-1.5 w-4 h-4 rounded-full border-2 border-background bg-muted-foreground group-last:bg-primary z-10" />

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">
                          {(entry.division || "ALL").replace(/_/g, " ")}
                          {entry.action ? ` • ${entry.action}` : ""}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                          {formatJakartaDate(
                            entry.entryDate || entry.createdAt,
                            "datetime",
                          )}
                        </span>
                      </div>
                      <div className="bg-muted/30 rounded-lg p-2 border border-border/50">
                        {entry.status && (
                          <p className="text-xs font-semibold text-primary/80 mb-1">
                            Status: {entry.status.replace(/_/g, " ")}
                          </p>
                        )}
                        {entry.notes && (
                          <p className="text-[11px] text-muted-foreground italic">
                            "{entry.notes}"
                          </p>
                        )}
                        {entry.updatedBy && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                            Oleh: {entry.updatedBy}
                          </p>
                        )}
                        {entry.exitDate && (
                          <p className="text-[10px] text-muted-foreground/70 mt-1 border-t border-border/20 pt-1">
                            Completed:{" "}
                            {formatJakartaDate(entry.exitDate, "datetime")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-8 text-muted-foreground italic text-xs">
                No history records found for this project.
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
