import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getBalance, creditAccount } from "../core/billing/creditService";

const LOW_BALANCE_THRESHOLD = 100;

export default async function billingRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/balance", async (request) => {
    const accountId = request.user.accountId;
    const balance = await getBalance(prisma, accountId);
    return { balance, lowBalance: balance < LOW_BALANCE_THRESHOLD, threshold: LOW_BALANCE_THRESHOLD };
  });

  fastify.get("/ledger", async (request) => {
    const accountId = request.user.accountId;
    return prisma.creditLedger.findMany({ where: { accountId }, orderBy: { createdAt: "desc" }, take: 200 });
  });

  fastify.get("/prices", async (request) => {
    const accountId = request.user.accountId;
    return prisma.channelPrice.findMany({ where: { accountId } });
  });

  fastify.post("/recharge", { preHandler: fastify.requireRole("ADMIN") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { credits } = z.object({ credits: z.number().positive() }).parse(request.body);
    const balanceAfter = await creditAccount(prisma, accountId, credits, "Recarga manual (simulada)");
    reply.code(201).send({ balance: balanceAfter });
  });
}
