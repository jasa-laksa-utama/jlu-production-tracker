import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Search, MoreHorizontal, PenTool, ClipboardCheck, Factory, Truck } from "lucide-react";
import { Badge } from "./ui/badge";

const activeProjects = [
  { id: 1, name: "Conveyor System A", client: "PT. Alpha", stage: "Engineering", status: "Waiting Approval", date: "Nov 12", icon: PenTool, color: "text-blue-500", bg: "bg-blue-500/10" },
  { id: 2, name: "Roller Conveyor B", client: "PT. Beta", stage: "PPIC", status: "Checking Material", date: "Nov 15", icon: ClipboardCheck, color: "text-orange-500", bg: "bg-orange-500/10" },
  { id: 3, name: "Belt Conveyor C", client: "PT. Gamma", stage: "Produksi", status: "Sandblasting", date: "Nov 20", icon: Factory, color: "text-purple-500", bg: "bg-purple-500/10" },
  { id: 4, name: "Heavy Duty Conveyor D", client: "PT. Delta", stage: "Logistik", status: "Marking", date: "Nov 22", icon: Truck, color: "text-green-500", bg: "bg-green-500/10" },
];

export function RecentDocuments() {
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Active Projects Tracker</h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              placeholder="Search project..." 
              className="pl-9 w-[250px] shadow-none bg-background rounded-full border-border h-9 text-sm"
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 rounded-full px-4 shadow-none">View All</Button>
        </div>
      </div>
      
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="w-[300px] font-medium text-muted-foreground">Project Name</TableHead>
              <TableHead className="font-medium text-muted-foreground">Client</TableHead>
              <TableHead className="font-medium text-muted-foreground">Current Stage</TableHead>
              <TableHead className="font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="font-medium text-muted-foreground">Expected Date</TableHead>
              <TableHead className="text-right font-medium text-muted-foreground"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeProjects.map((doc) => {
              const Icon = doc.icon;
              return (
              <TableRow key={doc.id} className="border-border/50 hover:bg-muted/30">
                <TableCell className="font-medium flex items-center gap-2">
                  <div className={`p-1.5 rounded-md ${doc.color} ${doc.bg}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {doc.name}
                </TableCell>
                <TableCell className="text-muted-foreground">{doc.client}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">{doc.stage}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{doc.status}</TableCell>
                <TableCell className="text-muted-foreground">{doc.date}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2 text-muted-foreground">
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )})}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
