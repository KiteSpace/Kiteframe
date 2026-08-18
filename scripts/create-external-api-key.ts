// One-off script to issue a scoped external API key (e.g. for the Claude
// Code skill). Prints the raw key ONCE — it is never retrievable again since
// only its sha256 hash is stored. Run with: npx tsx scripts/create-external-api-key.ts <name>
import crypto from "crypto";
import { storage } from "../server/storage";

async function main() {
  const name = process.argv[2] || "claude-code-skill";

  const rawKey = `kf_ext_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey, "utf8").digest("hex");

  const created = await storage.createExternalApiKey({ name, keyHash });

  console.log("\n=== External API key created ===");
  console.log(`Name:    ${created.name}`);
  console.log(`Key ID:  ${created.id}`);
  console.log(`Raw key: ${rawKey}`);
  console.log("\nSave this raw key as a secret NOW (e.g. EXTERNAL_API_KEY).");
  console.log("It is hashed at rest and cannot be displayed again.\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to create external API key:", err);
    process.exit(1);
  });
