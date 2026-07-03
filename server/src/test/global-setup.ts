import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../");

export default async function globalSetup() {
  const parsed = config({ path: path.join(rootDir, ".env.test") }).parsed || {};

  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    cwd: rootDir,
    env: { ...process.env, ...parsed },
    stdio: "inherit",
  });
}
