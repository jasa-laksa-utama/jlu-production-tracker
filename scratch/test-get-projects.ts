import { getProjectsByDivision } from "../src/app/actions/projects";

async function main() {
  const res = await getProjectsByDivision("PPIC", {
    page: 1,
    pageSize: 10,
    search: "",
    status: "ALL",
  });
  console.log("getProjectsByDivision result:", JSON.stringify(res, null, 2));
}

main().catch(console.error);
