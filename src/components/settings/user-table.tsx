"use client";

import { useState, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  UserPlus,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Search,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
} from "@/app/actions/users";
import { Checkbox } from "@/components/ui/checkbox";
import { sanitizeInput, formatEmail } from "@/lib/utils";

export function UserTable({ users, roles }: { users: any[]; roles: any[] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    name: "",
    password: "",
    position: "",
    roleIds: [] as string[],
    isActive: true,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const sanitizedData = {
        ...formData,
        username: sanitizeInput(formData.username),
        email: formatEmail(formData.email),
        name: sanitizeInput(formData.name),
        position: sanitizeInput(formData.position),
      };
      const result = await createUser(sanitizedData);
      if (result.success) {
        toast.success("User berhasil dibuat");
        setIsCreateOpen(false);
        setFormData({
          username: "",
          email: "",
          name: "",
          password: "",
          position: "",
          roleIds: [],
          isActive: true,
        });
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const sanitizedData = {
        ...formData,
        username: sanitizeInput(formData.username),
        email: formatEmail(formData.email),
        name: sanitizeInput(formData.name),
        position: sanitizeInput(formData.position),
      };
      const result = await updateUser(selectedUser.id, sanitizedData);
      if (result.success) {
        toast.success("User berhasil diperbarui");
        setIsEditOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = async () => {
    startTransition(async () => {
      const result = await deleteUser(selectedUser.id);
      if (result.success) {
        toast.success("User berhasil dihapus");
        setIsDeleteOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleToggleStatus = async (user: any, targetStatus: boolean) => {
    startTransition(async () => {
      const result = await toggleUserStatus(user.id, targetStatus);
      if (result.success) {
        toast.success(
          `User berhasil di${targetStatus ? "aktifkan" : "nonaktifkan"}`,
        );
        setIsStatusDialogOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  const openEdit = (user: any) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      name: user.name,
      password: "", // Jangan tampilkan password lama
      position: user.position || "",
      roleIds: user.roles.map((r: any) => r.id),
      isActive: user.isActive,
    });
    setIsEditOpen(true);
  };

  const openCreate = () => {
    setFormData({
      username: "",
      email: "",
      name: "",
      password: "",
      position: "",
      roleIds: [],
      isActive: true,
    });
    setIsCreateOpen(true);
  };

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase();
    return (
      user.name.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      (user.position && user.position.toLowerCase().includes(query)) ||
      user.username.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">User Management</h2>
          <p className="text-muted-foreground">Manage users and their roles.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input
              placeholder="Search Name, Email..."
              className="pl-9 w-64 h-9 bg-white/50 border-border/60 focus:bg-white transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Dialog
            open={isCreateOpen}
            onOpenChange={(open) => {
              if (open) openCreate();
              else setIsCreateOpen(false);
            }}
          >
            <DialogTrigger
              render={
                <Button className="gap-2 h-9 shadow-sm cursor-pointer hover:bg-primary/90 transition-all active:scale-95">
                  <UserPlus className="h-4 w-4" />
                  Add User
                </Button>
              }
            />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Enter the details for the new team member.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate}>
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-2 -mr-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="create-username">
                        Username <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="create-username"
                        placeholder="e.g. jdoe"
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({ ...formData, username: e.target.value })
                        }
                        required
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Unique identifier for login.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="create-name">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="create-name"
                        placeholder="e.g. John Doe"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                      <p className="text-[10px] text-muted-foreground">
                        User's display name.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-email">
                      E-mail <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="create-email"
                      type="email"
                      placeholder="e.g. john@company.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      required
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Used for notifications and login.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-password">
                      Password <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="create-password"
                        type={showCreatePassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData({ ...formData, password: e.target.value })
                        }
                        required
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-9 w-9 text-muted-foreground cursor-pointer"
                        onClick={() =>
                          setShowCreatePassword(!showCreatePassword)
                        }
                      >
                        {showCreatePassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Min. 8 characters.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="create-position">Position</Label>
                    <Input
                      id="create-position"
                      placeholder="e.g. Project Manager"
                      value={formData.position}
                      onChange={(e) =>
                        setFormData({ ...formData, position: e.target.value })
                      }
                    />
                    <p className="text-[10px] text-muted-foreground">
                      The user's official job title.
                    </p>
                  </div>
                  <div className="space-y-3 pt-2">
                    <Label>Roles</Label>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/20">
                      {roles.map((role) => (
                        <div
                          key={role.id}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`role-${role.id}`}
                            checked={formData.roleIds.includes(role.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({
                                  ...formData,
                                  roleIds: [...formData.roleIds, role.id],
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  roleIds: formData.roleIds.filter(
                                    (id) => id !== role.id,
                                  ),
                                });
                              }
                            }}
                          />
                          <label
                            htmlFor={`role-${role.id}`}
                            className="text-[11px] cursor-pointer select-none"
                          >
                            {role.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter className="pt-2">
                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full cursor-pointer transition-all active:scale-95"
                  >
                    {isPending ? "Saving..." : "Save User"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="border rounded-xl bg-card/50 overflow-hidden box-shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10 text-center">No</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user, index) => (
                <TableRow
                  key={user.id}
                  className="hover:bg-muted/10 transition-colors"
                >
                  <TableCell className="text-center text-sm text-muted-foreground font-mono">
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{user.position || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role: any) => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                          className="px-1.5 py-0 text-[10px] bg-primary/5 text-primary border-primary/10"
                        >
                          {role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.isActive ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 border-green-500/20 text-green-600 bg-green-50/50"
                      >
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 border-red-500/20 text-red-600 bg-red-50/50"
                      >
                        <XCircle className="h-3 w-3" /> Non-active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 cursor-pointer"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openEdit(user)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit User
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            onClick={() => {
                              setSelectedUser(user);
                              setIsStatusDialogOpen(true);
                            }}
                          >
                            {user.isActive ? (
                              <>
                                <XCircle className="mr-2 h-4 w-4 text-red-500" />{" "}
                                Deactivate User
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />{" "}
                                Activate User
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-red-600 focus:bg-red-50 focus:text-red-700"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeleteOpen(true);
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete User
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

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update account information and roles.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate}>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto px-2 -mr-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-username">
                    Username <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Unique identifier for login.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    placeholder="e.g. John Doe"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                  <p className="text-[10px] text-muted-foreground">
                    User's display name.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">
                  E-mail <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="e.g. john@company.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  Active email address.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">
                  New Password (Leave empty if not changing)
                </Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-9 w-9 text-muted-foreground"
                    onClick={() => setShowEditPassword(!showEditPassword)}
                  >
                    {showEditPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Min. 8 characters if updating.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-position">Position</Label>
                <Input
                  id="edit-position"
                  placeholder="e.g. Project Manager"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                />
                <p className="text-[10px] text-muted-foreground">
                  User's job title.
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <Label>Roles</Label>
                <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/20">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role.id}`}
                        checked={formData.roleIds.includes(role.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              roleIds: [...formData.roleIds, role.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              roleIds: formData.roleIds.filter(
                                (id) => id !== role.id,
                              ),
                            });
                          }
                        }}
                      />
                      <label
                        htmlFor={`edit-role-${role.id}`}
                        className="text-[11px] cursor-pointer select-none"
                      >
                        {role.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="w-full cursor-pointer hover:bg-primary/90 transition-all active:scale-95"
              >
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Status Toggle Confirmation Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Confirm {selectedUser?.isActive ? "Deactivation" : "Activation"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to{" "}
              <span className="font-semibold">
                {selectedUser?.isActive ? "deactivate" : "activate"}
              </span>{" "}
              user <span className="font-bold">{selectedUser?.name}</span>?
              {selectedUser?.isActive
                ? " The user will no longer be able to log in to the system."
                : " The user will be granted access to log in again."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setIsStatusDialogOpen(false)}
              className="cursor-pointer transition-all active:scale-95"
            >
              Cancel
            </Button>
            <Button
              variant={selectedUser?.isActive ? "destructive" : "default"}
              onClick={() =>
                handleToggleStatus(selectedUser, !selectedUser.isActive)
              }
              disabled={isPending}
              className="cursor-pointer transition-all active:scale-95"
            >
              {isPending
                ? "Processing..."
                : `Yes, ${selectedUser?.isActive ? "Deactivate" : "Activate"} User`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Confirmation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user{" "}
              <span className="font-bold text-foreground">
                {selectedUser?.name}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isPending}
              className="cursor-pointer transition-all active:scale-95"
            >
              {isPending ? "Deleting..." : "Yes, Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
