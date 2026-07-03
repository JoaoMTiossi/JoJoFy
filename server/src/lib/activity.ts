import { prisma } from "./prisma.js";

export async function logActivity(
  cardId: string,
  actorName: string,
  type: string,
  detail: string
) {
  return prisma.activity.create({
    data: { cardId, actorName, type, detail },
  });
}
