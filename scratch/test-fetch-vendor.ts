import "dotenv/config";
import { getPendingSPBVendorSelection } from "../src/app/actions/spb";

async function test() {
  console.log("Calling getPendingSPBVendorSelection('ENGINEERING')...");
  const res = await getPendingSPBVendorSelection("ENGINEERING");
  console.log("Result success:", res.success);
  console.log("Found items count:", res.data?.length);
  console.dir(res.data, { depth: null });
}

test();
