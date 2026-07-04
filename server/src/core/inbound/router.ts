import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { createOptOut } from "../contacts/optOutService";
import { emitMessageEvent } from "../messaging/hooks";
import { realtimeHub } from "../realtime/hub";
import { markContactReplied } from "../journeys/runner";
import { startFlowSession, continueFlowSession } from "../bot/flowEngine";

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
 * sessão de fluxo ativa (FlowEngine) → (M8) conversa aberta com agente →
 * fluxo publicado no canal (keyword/default) → (M8) fila padrão.
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

  // 1) sessão de fluxo já ativa para este contato neste canal
  const activeSession = await prisma.flowSession.findFirst({
    where: { contactId: input.contactId, status: "ACTIVE", flow: { channelId: input.channelId } },
  });
  if (activeSession) {
    await continueFlowSession(input.accountId, input.channelId, activeSession.id, input.text);
    return { message, optedOut: false, flow: true };
  }

  // (M8 preenche aqui: conversa já aberta com um agente → anexar em vez de acionar o bot)

  // 2) fluxo publicado no canal: match de palavra-chave, senão o marcado como padrão
  const flows = await prisma.flow.findMany({
    where: { accountId: input.accountId, channelId: input.channelId, published: { not: null } },
  });
  const matched =
    flows.find((f) => f.keywords?.split(",").map((k) => k.trim().toLowerCase()).includes(normalized)) ??
    flows.find((f) => f.isDefault);
  if (matched) {
    await startFlowSession(input.accountId, matched.id, input.contactId, input.channelId);
    return { message, optedOut: false, flow: true };
  }

  // (M8 preenche aqui: sem fluxo → cria Conversation na fila padrão)

  return { message, optedOut: false };
}
