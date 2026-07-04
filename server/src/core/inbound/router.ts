import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { createOptOut } from "../contacts/optOutService";
import { emitMessageEvent } from "../messaging/hooks";
import { realtimeHub } from "../realtime/hub";
import { markContactReplied } from "../journeys/runner";

const OPT_OUT_KEYWORDS = ["sair", "parar", "stop", "cancelar", "unsubscribe"];

export interface InboundInput {
  accountId: string;
  contactId: string;
  channelId: string;
  text: string;
  source?: "SIMULATOR" | "API";
}

/**
 * Ponto único de entrada para mensagens recebidas (só existe via simulação,
 * não há operadora real). Decide, nesta ordem: opt-out por palavra-chave →
 * (M7) sessão de fluxo ativa → (M8) conversa aberta com agente → (M7) fluxo
 * publicado → (M8) fila padrão. Milestones futuros preenchem os passos ainda
 * não implementados.
 */
export async function handleInbound(input: InboundInput) {
  const channel = await prisma.channel.findFirst({ where: { id: input.channelId, accountId: input.accountId } });
  if (!channel) throw Errors.notFound("Canal não encontrado");

  const contact = await prisma.contact.findFirst({ where: { id: input.contactId, accountId: input.accountId } });
  if (!contact) throw Errors.notFound("Contato não encontrado");

  const message = await prisma.message.create({
    data: {
      accountId: input.accountId,
      direction: "IN",
      channelId: input.channelId,
      channelType: channel.type,
      contactId: input.contactId,
      source: input.source ?? "SIMULATOR",
      body: JSON.stringify({ text: input.text }),
      status: "DELIVERED",
    },
  });

  realtimeHub.broadcast(input.accountId, "message.received", { message });
  await emitMessageEvent("message.received", { message });
  await markContactReplied(input.accountId, input.contactId);

  const normalized = input.text.trim().toLowerCase();
  if (OPT_OUT_KEYWORDS.includes(normalized)) {
    const optOut = await createOptOut(input.accountId, input.contactId, channel.type, `Solicitado pelo contato via "${input.text.trim()}"`);
    return { message, optedOut: true, optOut };
  }

  return { message, optedOut: false };
}
