"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  MoreHorizontal,
  Plus,
  Edit,
  UserX,
  UserCheck,
  Briefcase,
  Eye,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  CheckCircle2,
  Loader2,
  MapPin,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  createCustomer,
  toggleCustomerStatus,
  updateCustomer,
} from "@/app/actions/customers";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import { sanitizeInput, formatEmail, formatPhoneNumber } from "@/lib/utils";

export function CustomerTable({
  customers,
  meta,
}: {
  customers: any[];
  meta?: any;
}) {
  const [isPending, startTransition] = useTransition();
  const [dialogKey, setDialogKey] = useState(0);
  const [viewCustomer, setViewCustomer] = useState<any | null>(null);
  const [editCustomer, setEditCustomer] = useState<any | null>(null);
  const [toggleConfirmCustomer, setToggleConfirmCustomer] = useState<
    any | null
  >(null);
  const [editDialogKey, setEditDialogKey] = useState(0);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extraction from searchParams
  const currentPage = Number(searchParams.get("cpage")) || 1;
  const currentLimit = Number(searchParams.get("climit")) || 10;
  const currentSearch = searchParams.get("csearch") || "";
  const currentActive = searchParams.get("cactive") || "ALL";
  const currentLeads = searchParams.get("cleads") || "ALL";
  const currentSort = searchParams.get("csort") || "desc";

  const [searchInput, setSearchInput] = useState(currentSearch);

  const totalPages = meta?.totalPages || 1;
  const pageSize = currentLimit;

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    if (!updates.cpage) params.set("cpage", "1");
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== currentSearch) {
        updateQuery({ csearch: searchInput });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function handleCreateSubmit(formData: FormData) {
    const name = formData.get("name") as string;
    const company = formData.get("company") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const province = formData.get("province") as string;

    const sanitizedData = new FormData();
    sanitizedData.append("name", sanitizeInput(name));
    sanitizedData.append("company", sanitizeInput(company));
    sanitizedData.append("email", formatEmail(email));
    sanitizedData.append("phone", formatPhoneNumber(phone));
    sanitizedData.append("address", sanitizeInput(address));
    sanitizedData.append("city", sanitizeInput(city));
    sanitizedData.append("province", sanitizeInput(province));

    const promise = async () => {
      const result = await createCustomer(sanitizedData);
      if (result.error) throw new Error(result.error);
      setDialogKey((k) => k + 1);
      router.refresh();
      return result;
    };

    toast.promise(promise(), {
      loading: "Sedang menambahkan customer baru...",
      success: "Customer berhasil ditambahkan!",
      error: (err) =>
        err.message || "Gagal menambahkan customer. Silakan coba lagi.",
    });
  }

  async function handleEditSubmit(formData: FormData) {
    if (!editCustomer) return;
    const name = formData.get("name") as string;
    const company = formData.get("company") as string;
    const email = formData.get("email") as string;
    const phone = formData.get("phone") as string;
    const address = formData.get("address") as string;
    const city = formData.get("city") as string;
    const province = formData.get("province") as string;

    const sanitizedData = new FormData();
    sanitizedData.append("name", sanitizeInput(name));
    sanitizedData.append("company", sanitizeInput(company));
    sanitizedData.append("email", formatEmail(email));
    sanitizedData.append("phone", formatPhoneNumber(phone));
    sanitizedData.append("address", sanitizeInput(address));
    sanitizedData.append("city", sanitizeInput(city));
    sanitizedData.append("province", sanitizeInput(province));

    const promise = async () => {
      const result = await updateCustomer(editCustomer.id, sanitizedData);
      if (result.error) throw new Error(result.error);
      setEditDialogKey((k) => k + 1);
      setEditCustomer(null);
      router.refresh();
      return result;
    };

    toast.promise(promise(), {
      loading: "Memperbarui profil...",
      success: "Profil customer berhasil diperbarui!",
      error: (err) =>
        err.message || "Gagal memperbarui profil. Silakan coba lagi.",
    });
  }

  async function performToggleStatus() {
    if (!toggleConfirmCustomer) return;
    const promise = async () => {
      const result = await toggleCustomerStatus(
        toggleConfirmCustomer.id,
        !toggleConfirmCustomer.isActive,
      );
      if (result.error) throw new Error(result.error);
      setToggleConfirmCustomer(null);
      router.refresh();
      return result;
    };

    const actionText = toggleConfirmCustomer.isActive
      ? "menonaktifkan"
      : "mengaktifkan";
    toast.promise(promise(), {
      loading: `Sedang ${actionText} customer...`,
      success: `Customer berhasil ${toggleConfirmCustomer.isActive ? "dinonaktifkan" : "diaktifkan"}!`,
      error: (err) =>
        err.message || `Gagal ${actionText} customer. Silakan coba lagi.`,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search customers..."
              className="pl-9 w-full shadow-none bg-background rounded-md border-border h-9 text-sm"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-all active:scale-95"
                >
                  <Filter className="w-4 h-4" />
                  Filter
                  {(currentActive !== "ALL" ||
                    currentLeads !== "ALL" ||
                    currentSort !== "desc") && (
                    <Badge
                      variant="secondary"
                      className="ml-1 px-1 h-5 min-w-5 justify-center rounded-full bg-primary text-primary-foreground"
                    >
                      !
                    </Badge>
                  )}
                </Button>
              }
            />
            <PopoverContent className="w-80 p-4 space-y-4" align="end">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Status
                </label>
                <div className="flex gap-2">
                  {[
                    { label: "All", value: "ALL" },
                    { label: "Active", value: "true" },
                    { label: "Inactive", value: "false" },
                  ].map((opt) => (
                    <Button
                      key={opt.value}
                      variant={
                        currentActive === opt.value ? "default" : "outline"
                      }
                      size="sm"
                      className="h-8 text-xs flex-1 cursor-pointer"
                      onClick={() => updateQuery({ cactive: opt.value })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Lead Availability
                </label>
                <Button
                  variant={currentLeads === "true" ? "default" : "outline"}
                  size="sm"
                  className="w-full justify-start h-9 gap-2 cursor-pointer"
                  onClick={() =>
                    updateQuery({
                      cleads: currentLeads === "true" ? "ALL" : "true",
                    })
                  }
                >
                  <Briefcase className="w-4 h-4" />
                  Has Active Leads (leads &gt; 0)
                  {currentLeads === "true" && (
                    <CheckCircle2 className="w-4 h-4 ml-auto" />
                  )}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground">
                  Sorting
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-between h-9 cursor-pointer"
                  onClick={() =>
                    updateQuery({
                      csort: currentSort === "asc" ? "desc" : "asc",
                    })
                  }
                >
                  <span className="flex items-center gap-2">
                    <ArrowUpDown className="w-4 h-4" />
                    Sort by Date Joined
                  </span>
                  <Badge variant="secondary">
                    {currentSort === "desc" ? "DESC" : "ASC"}
                  </Badge>
                </Button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs hover:bg-primary/90 bg-primary text-primary-foreground hover:text-primary-foreground h-8 cursor-pointer"
                onClick={() => {
                  setSearchInput("");
                  router.push(pathname);
                }}
              >
                Reset Filters
              </Button>
            </PopoverContent>
          </Popover>
          <div className="flex items-center gap-2 text-muted-foreground ml-1">
            <span className="text-xs">
              Results:{" "}
              <span className="font-semibold">{meta?.totalCount || 0}</span>{" "}
              customers
            </span>
          </div>
        </div>

        <Dialog key={dialogKey}>
          <DialogTrigger className="inline-flex w-full md:w-auto items-center justify-center whitespace-nowrap rounded-md text-sm hover:bg-primary/90 bg-primary text-primary-foreground h-9 px-4 shadow-none cursor-pointer font-semibold transition-all active:scale-95">
            <Plus className="w-4 h-4 mr-2" /> New Customer
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] md:max-w-[700px] w-full">
            <DialogHeader>
              <DialogTitle>Create New Customer</DialogTitle>
              <DialogDescription>
                Tambahkan kontak atau perusahaan baru ke database pelanggan.
              </DialogDescription>
            </DialogHeader>
            <form action={handleCreateSubmit} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input name="name" required placeholder="John Doe" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company</label>
                  <Input name="company" placeholder="Acme Corp" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    name="email"
                    type="email"
                    placeholder="john@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input name="phone" placeholder="+1234567890" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alamat Lengkap</label>
                <textarea
                  name="address"
                  placeholder="Jl. Sudirman No. 123, Kel. ..."
                  className="flex min-h-[85px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kota / Kabupaten</label>
                  <Input name="city" placeholder="Contoh: Jakarta Selatan" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Provinsi</label>
                  <Input name="province" placeholder="Contoh: DKI Jakarta" />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <DialogTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 cursor-pointer transition-all active:scale-95">
                  Cancel
                </DialogTrigger>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer transition-all active:scale-95 px-5 font-semibold"
                >
                  {isPending ? "Saving..." : "Save Customer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-row items-center justify-between text-sm py-1 border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-xs whitespace-nowrap">Show:</span>
          <select
            value={currentLimit}
            onChange={(e) =>
              updateQuery({ climit: e.target.value, cpage: "1" })
            }
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => updateQuery({ cpage: String(currentPage - 1) })}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-muted-foreground mx-1 text-xs">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => updateQuery({ cpage: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="border border-border rounded-xl bg-card overflow-hidden relative">
        {isPending && (
          <div className="absolute inset-0 z-10 bg-background/40 backdrop-blur-[1px] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-background/80 p-3 rounded-full shadow-lg border border-border">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          </div>
        )}
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border text-xs font-bold">
              <TableHead className="w-[50px] text-center">No</TableHead>
              <TableHead className="w-[180px]">Name</TableHead>
              <TableHead className="w-[170px]">Company</TableHead>
              <TableHead className="min-w-[220px]">Alamat & Lokasi</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-center">Leads</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center h-48">
                  <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p>No customers found matching your criteria.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer, index) => (
                <TableRow
                  key={customer.id}
                  className="border-border/50 hover:bg-muted/30 group"
                >
                  <TableCell className="text-center text-muted-foreground text-xs font-mono">
                    {(currentPage - 1) * pageSize + index + 1}
                  </TableCell>
                  <TableCell className="font-medium">
                    {customer.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-medium">
                    {customer.company || "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5 max-w-[260px]">
                      {(customer.city || customer.province) && (
                        <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate">
                            {[customer.city, customer.province]
                              .filter(Boolean)
                              .join(" - ")}
                          </span>
                        </div>
                      )}
                      {customer.address ? (
                        <span
                          className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed"
                          title={customer.address}
                        >
                          {customer.address}
                        </span>
                      ) : (
                        !customer.city &&
                        !customer.province && (
                          <span className="text-xs text-muted-foreground">-</span>
                        )
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs flex flex-col gap-1">
                    {customer.email && <span>{customer.email}</span>}
                    {customer.phone && (
                      <span className="opacity-70">{customer.phone}</span>
                    )}
                    {!customer.email && !customer.phone && "-"}
                  </TableCell>
                  <TableCell>
                    {customer.isActive ? (
                      <Badge
                        variant="outline"
                        className="bg-green-500/10 text-green-600 font-normal border-green-200"
                      >
                        Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-muted text-muted-foreground font-normal"
                      >
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="font-normal">
                      {customer._count?.leads || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-8 w-8 hover:bg-muted cursor-pointer">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            onClick={() => setViewCustomer(customer)}
                          >
                            <Eye className="w-4 h-4 mr-2 text-blue-500" /> View
                            Detail
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditCustomer(customer)}
                          >
                            <Edit className="w-4 h-4 mr-2 text-amber-500" />{" "}
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setToggleConfirmCustomer(customer)}
                            className={
                              customer.isActive
                                ? "text-destructive"
                                : "text-green-600"
                            }
                          >
                            {customer.isActive ? (
                              <>
                                <UserX className="w-4 h-4 mr-2" /> Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-4 h-4 mr-2" /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Customer Dialog */}
      <Dialog
        open={!!viewCustomer}
        onOpenChange={(open) => !open && setViewCustomer(null)}
      >
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
            <DialogDescription>
              Viewing information for {viewCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          {viewCustomer && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-y-3 text-sm">
                <div className="font-medium text-muted-foreground">Name</div>
                <div className="col-span-2 font-medium">
                  {viewCustomer.name}
                </div>
                <div className="font-medium text-muted-foreground">Company</div>
                <div className="col-span-2">{viewCustomer.company || "-"}</div>
                <div className="font-medium text-muted-foreground">Email</div>
                <div className="col-span-2">{viewCustomer.email || "-"}</div>
                <div className="font-medium text-muted-foreground">Phone</div>
                <div className="col-span-2">{viewCustomer.phone || "-"}</div>
                <div className="font-medium text-muted-foreground">
                  Alamat Lengkap
                </div>
                <div className="col-span-2 whitespace-pre-wrap">
                  {viewCustomer.address || "-"}
                </div>
                <div className="font-medium text-muted-foreground">
                  Kota / Kabupaten
                </div>
                <div className="col-span-2">{viewCustomer.city || "-"}</div>
                <div className="font-medium text-muted-foreground">
                  Provinsi
                </div>
                <div className="col-span-2">{viewCustomer.province || "-"}</div>
                <div className="font-medium text-muted-foreground">Status</div>
                <div className="col-span-2">
                  <Badge
                    variant="outline"
                    className={
                      viewCustomer.isActive
                        ? "bg-green-500/10 text-green-600 border-green-200 uppercase text-[10px] font-bold"
                        : "bg-muted uppercase text-[10px] font-bold"
                    }
                  >
                    {viewCustomer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setViewCustomer(null)}
                  className="cursor-pointer transition-all active:scale-95"
                >
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog
        key={`edit-${editDialogKey}`}
        open={!!editCustomer}
        onOpenChange={(open) => !open && setEditCustomer(null)}
      >
        <DialogContent className="sm:max-w-[650px] md:max-w-[700px] w-full">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
            <DialogDescription>
              Editing information for {editCustomer?.name}
            </DialogDescription>
          </DialogHeader>
          {editCustomer && (
            <form action={handleEditSubmit} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name *</label>
                  <Input name="name" required defaultValue={editCustomer.name} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Company</label>
                  <Input
                    name="company"
                    defaultValue={editCustomer.company || ""}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    name="email"
                    type="email"
                    defaultValue={editCustomer.email || ""}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Phone</label>
                  <Input name="phone" defaultValue={editCustomer.phone || ""} />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Alamat Lengkap</label>
                <textarea
                  name="address"
                  defaultValue={editCustomer.address || ""}
                  placeholder="Jl. Sudirman No. 123, Kel. ..."
                  className="flex min-h-[85px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Kota / Kabupaten</label>
                  <Input
                    name="city"
                    defaultValue={editCustomer.city || ""}
                    placeholder="Contoh: Jakarta Selatan"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Provinsi</label>
                  <Input
                    name="province"
                    defaultValue={editCustomer.province || ""}
                    placeholder="Contoh: DKI Jakarta"
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditCustomer(null)}
                  className="cursor-pointer transition-all active:scale-95"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer transition-all active:scale-95 px-5 font-semibold"
                >
                  {isPending ? "Updating..." : "Update Customer"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Toggle Status Confirmation Dialog */}
      <Dialog
        open={!!toggleConfirmCustomer}
        onOpenChange={(open) => !open && setToggleConfirmCustomer(null)}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {toggleConfirmCustomer?.isActive ? "Deactivate" : "Activate"}{" "}
              Customer
            </DialogTitle>
            <DialogDescription>
              Are you sure for <b>{toggleConfirmCustomer?.name}</b>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              variant="outline"
              onClick={() => setToggleConfirmCustomer(null)}
              disabled={isPending}
              className="cursor-pointer transition-all active:scale-95"
            >
              Cancel
            </Button>
            <Button
              variant={
                toggleConfirmCustomer?.isActive ? "destructive" : "default"
              }
              disabled={isPending}
              onClick={performToggleStatus}
              className="cursor-pointer transition-all active:scale-95"
            >
              {isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
