import { prisma } from "@/lib/prisma";
import { runStrategicIngest, type StrategicMode } from "@/lib/strategic-ingest";

function parseArg(name: string, fallback: string): string {
  const entry = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.split("=").slice(1).join("=") : fallback;
}

async function main() {
  const markets = parseArg("markets", "montreal,toronto,ottawa,vancouver,calgary,edmonton")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const mode = (parseArg("mode", "preview") as StrategicMode);
  const includeBroadResidential = parseArg("includeBroadResidential", "0") === "1";

  if (mode !== "preview" && mode !== "ingest") {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const result = await runStrategicIngest({
    markets,
    mode,
    includeBroadResidential,
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
