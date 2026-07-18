import { AppSidebar } from "@/components/app-sidebar";
import { DashboardHeader } from "@/components/dashboard-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerTable } from "@/components/leads/customer-table";
import { LeadTable } from "@/components/leads/lead-table";
import { getCustomers } from "@/app/actions/customers";
import { getLeads } from "@/app/actions/leads";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const params = await searchParams;

  // Leads params
  const lPage = Number(params.page) || 1;
  const lLimit = Number(params.limit) || 10;
  const lSearch = (params.search as string) || "";
  const lStatus = (params.status as string) || "ALL";
  const lStart = params.start as string | undefined;
  const lEnd = params.end as string | undefined;
  const lSort = (params.sort as "asc" | "desc") || "desc";

  // Customers params
  const cPage = Number(params.cpage) || 1;
  const cLimit = Number(params.climit) || 10;
  const cSearch = (params.csearch as string) || "";
  const cActive = (params.cactive as string) || "ALL";
  const cHasLeads = (params.cleads as string) || "ALL";
  const cSort = (params.csort as "asc" | "desc") || "desc";

  const { data: leadsData = [], meta: leadsMeta } = await getLeads({
    page: lPage,
    pageSize: lLimit,
    search: lSearch,
    status: lStatus,
    startDate: lStart,
    endDate: lEnd,
    sortOrder: lSort,
  });

  const { data: customersData = [], meta: customersMeta } = await getCustomers({
    page: cPage,
    pageSize: cLimit,
    search: cSearch,
    isActive: cActive,
    hasLeads: cHasLeads,
    sortOrder: cSort,
  });

  // Also need all active customers for the "New Lead" dialog
  const { data: allActiveCustomers = [] } = await getCustomers({ pageSize: 1000, isActive: "true" });

  return (
    <div className="flex w-full overflow-hidden bg-background h-screen">
      <AppSidebar />
      <div className="flex flex-col flex-1 w-full bg-background md:rounded-tl-xl md:border-l md:border-t border-border overflow-hidden md:m-2 md:ml-0 shadow-sm relative">
        <DashboardHeader />
        <main className="flex-1 w-full p-6 pb-2 overflow-y-auto overflow-x-hidden space-y-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight">
              Leads & Customers
            </h2>
            <p className="text-muted-foreground">
              Manage your contacts and track potential projects.
            </p>
          </div>

          <Tabs defaultValue="leads" className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
              <TabsTrigger className="cursor-pointer" value="leads">
                Data Leads
              </TabsTrigger>
              <TabsTrigger className="cursor-pointer" value="customers">
                Data Customer
              </TabsTrigger>
            </TabsList>
            <TabsContent value="leads" className="m-0 mt-6">
              <LeadTable 
                leads={leadsData} 
                meta={leadsMeta}
                customers={allActiveCustomers} 
              />
            </TabsContent>
            <TabsContent value="customers" className="m-0 mt-6">
              <CustomerTable 
                customers={customersData} 
                meta={customersMeta}
              />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
