import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  executeContentPlan,
  type ContentPlan,
  type ContentReceipt,
} from "./content-correction-executor";
const planPath = process.argv[2];
if (!planPath || !process.argv.includes("--apply"))
  throw Error(
    "Usage: tsx scripts/apply-content-corrections.ts <reviewed-plan.json> --apply (explicit current authorization required)",
  );
const plan = JSON.parse(readFileSync(planPath, "utf8")) as ContentPlan;
const apiKey = process.env.CONTENT_API_KEY;
if (!apiKey)
  throw Error(
    "CONTENT_API_KEY must be provided securely in the executor environment",
  );
const ledger: ContentReceipt[] = [];
mkdirSync("artifacts", { recursive: true });
await executeContentPlan(plan, {
  apiKey,
  onReceipt(entry) {
    ledger.push(entry);
    writeFileSync(
      "artifacts/content-correction-receipts.json",
      JSON.stringify({ checkedAt: new Date().toISOString(), ledger }, null, 2),
    );
    process.stdout.write(`${entry.id}: ${entry.status}\n`);
  },
});
