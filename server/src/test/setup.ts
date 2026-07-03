import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { beforeEach, afterAll } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env.test"), override: true });

const { prisma } = await import("../lib/prisma.js");

beforeEach(async () => {
  await prisma.activity.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.cardLabel.deleteMany();
  await prisma.cardAssignee.deleteMany();
  await prisma.fieldValue.deleteMany();
  await prisma.card.deleteMany();
  await prisma.label.deleteMany();
  await prisma.field.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.pipe.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
