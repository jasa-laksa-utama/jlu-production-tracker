import { getUsers, getRoles } from "@/app/actions/users";
import { UserTable } from "@/components/settings/user-table";
import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";

export default async function UsersSettingsPage() {
  const users = await getUsers();
  const roles = await getRoles();

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />
        <main className="flex-1 w-full px-4 sm:px-6 py-6 pb-2 overflow-y-auto overflow-x-hidden space-y-6 max-w-full 2xl:max-w-[1920px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="space-y-6">
            <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
              <h1 className="text-3xl font-bold text-foreground">
                System Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Configure system settings and user management.
              </p>
            </div>

            <UserTable users={users} roles={roles} />
          </div>
        </main>
      </div>
    </div>
  );
}
