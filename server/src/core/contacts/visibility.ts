import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import type { JwtUser } from "../../plugins/auth";

const FULL_VIEW_ROLES = new Set(["ADMIN", "MANAGER", "DEVELOPER"]);

/**
 * Helper ÚNICO de visibilidade de contatos por papel (imposto nas queries,
 * nunca só na UI). ADMIN/MANAGER/DEVELOPER veem todos os contatos da conta;
 * AGENT enxerga um contato se QUALQUER condição vale:
 *   1. é o dono do contato (Contact.ownerId = agente);
 *   2. o contato tem conversa atribuída ao agente;
 *   3. o contato tem conversa não atribuída numa fila em que o agente é membro.
 */
export async function contactVisibilityWhere(user: JwtUser): Promise<Prisma.ContactWhereInput> {
  if (FULL_VIEW_ROLES.has(user.role)) {
    return { accountId: user.accountId };
  }

  const memberships = await prisma.queueMember.findMany({
    where: { userId: user.sub },
    select: { queueId: true },
  });
  const queueIds = memberships.map((m) => m.queueId);

  return {
    accountId: user.accountId,
    OR: [
      { ownerId: user.sub },
      { conversations: { some: { agentId: user.sub } } },
      ...(queueIds.length > 0
        ? [{ conversations: { some: { agentId: null, queueId: { in: queueIds } } } }]
        : []),
    ],
  };
}

/**
 * Carteirização automática: quando um AGENT assume (pull/atribuição) uma
 * conversa de contato SEM dono, o contato passa a ser dele. Contato que já
 * tem dono não muda. Só se aplica a usuários com papel AGENT.
 */
export async function claimContactOwnership(contactId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "AGENT") return;
  await prisma.contact.updateMany({
    where: { id: contactId, ownerId: null },
    data: { ownerId: userId },
  });
}
