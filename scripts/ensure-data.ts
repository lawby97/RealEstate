/**
 * Ensures database is in sync with Prisma schema and Prisma Client is generated.
 * Run before next dev so the app has a valid schema and client.
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { config } from "dotenv";

// Load .env from project root
config({ path: resolve(process.cwd(), ".env") });

console.log("Ensuring database and schema...");
execSync("npx prisma generate", { stdio: "inherit" });
execSync("npx prisma db push", { stdio: "inherit" });
console.log("Database ready.");
