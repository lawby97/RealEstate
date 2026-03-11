/**
 * Inspect CMHC RMR xlsx structure. Run: npx tsx scripts/inspect-cmhc-xlsx.ts [path]
 */

import * as XLSX from "xlsx";
import * as path from "path";

const defaultPath = path.join(process.env.HOME || "", "Downloads", "rmr-toronto-2025-en.xlsx");

async function main() {
  const filePath = process.argv[2] || defaultPath;
  console.log("Reading:", filePath);

  const workbook = XLSX.readFile(filePath);
  console.log("\nSheet names:", workbook.SheetNames);

  for (const name of workbook.SheetNames.slice(0, 8)) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    console.log(`\n--- ${name} (rows ${range.s.r}-${range.e.r}, cols ${range.s.c}-${range.e.c}) ---`);
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      console.log(JSON.stringify(rows[i]));
    }
  }
}

main().catch(console.error);
