import { Prisma, PrismaClient } from "@prisma/client";
import { Errors } from "../../lib/errors";

type Client = PrismaClient | Prisma.TransactionClient;

/** Saldo = balanceAfter da última entrada do ledger para a conta. */
export async function getBalance(client: Client, accountId: string): Promise<number> {
  const last = await client.creditLedger.findFirst({
    where: { accountId },
    orderBy: { createdAt: "desc" },
  });
  return last?.balanceAfter ?? 0;
}

export async function creditAccount(
  client: Client,
  accountId: string,
  delta: number,
  reason: string,
  ref?: { refType?: string; refId?: string }
) {
  const balance = await getBalance(client, accountId);
  const balanceAfter = balance + Math.abs(delta);
  await client.creditLedger.create({
    data: {
      accountId,
      delta: Math.abs(delta),
      balanceAfter,
      reason,
      refType: ref?.refType,
      refId: ref?.refId,
    },
  });
  return balanceAfter;
}

/** Debita créditos; lança 402 se saldo insuficiente. */
export async function debitAccount(
  client: Client,
  accountId: string,
  delta: number,
  reason: string,
  ref?: { refType?: string; refId?: string }
) {
  const balance = await getBalance(client, accountId);
  if (balance < delta) {
    throw Errors.paymentRequired(`Créditos insuficientes: saldo ${balance}, necessário ${delta}`);
  }
  const balanceAfter = balance - delta;
  await client.creditLedger.create({
    data: {
      accountId,
      delta: -Math.abs(delta),
      balanceAfter,
      reason,
      refType: ref?.refType,
      refId: ref?.refId,
    },
  });
  return balanceAfter;
}
