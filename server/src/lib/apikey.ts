import crypto from "node:crypto";
import { nanoid } from "nanoid";

export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const secret = nanoid(32);
  const prefix = `zv_${nanoid(8)}`;
  const raw = `${prefix}.${secret}`;
  const hash = hashApiKey(raw);
  return { raw, prefix, hash };
}

export function hashApiKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}
