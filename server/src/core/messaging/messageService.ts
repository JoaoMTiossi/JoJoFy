import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { renderTemplate } from "../../lib/template-render";
import { isOptedOut } from "../contacts/optOutService";
import { hasOpenWhatsAppWindow } from "./window";
import { debitAccount } from "../billing/creditService";
import { getProvider } from "../providers";
import { jobRunner } from "../jobs/instance";
import { scheduleFirstTransition } from "./statusPipeline";
import { emitMessageEvent } from "./hooks";
import { realtimeHub } from "../realtime/hub";

export interface SendMessageInput {
  accountId: string;
  contactId: string;
  channelId: string;
  source: "API" | "CAMPAIGN" | "BOT" | "AGENT" | "JOURNEY" | "SIMULATOR";
  conversationId?: string;
  campaignId?: string;
  templateId?: string;
  vars?: Record<string, string>;
  text?: string;
  idempotencyKey?: string;
}

async function getContactVars(contactId: string): Promise<Record<string, string>> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { attributeValues: { include: { def: true } } },
  });
  if (!contact) return {};
  const vars: Record<string, string> = {
    nome: contact.name,
    name: contact.name,
    telefone: contact.phone ?? "",
    email: contact.email ?? "",
  };
  for (const av of contact.attributeValues) vars[av.def.name] = av.value;
  return vars;
}

export async function getChannelPrice(accountId: string, channelType: string): Promise<number> {
  const price = await prisma.channelPrice.findUnique({
    where: { accountId_channelType: { accountId, channelType } },
  });
  return price?.credits ?? 1;
}

/**
 * Único caminho para qualquer envio de mensagem (API, campanha, bot, agente,
 * jornada). Valida opt-out e janela de 24h, renderiza variáveis, debita
 * créditos e cria a Message na mesma transação, entrega ao provider
 * simulado e agenda as transições de status.
 */
export async function sendMessage(input: SendMessageInput) {
  const channel = await prisma.channel.findFirst({ where: { id: input.channelId, accountId: input.accountId } });
  if (!channel) throw Errors.notFound("Canal não encontrado");

  const contact = await prisma.contact.findFirst({ where: { id: input.contactId, accountId: input.accountId } });
  if (!contact) throw Errors.notFound("Contato não encontrado");

  if (input.idempotencyKey) {
    const existing = await prisma.message.findFirst({
      where: { accountId: input.accountId, idempotencyKey: input.idempotencyKey },
    });
    if (existing) return existing;
  }

  if (await isOptedOut(input.contactId, channel.type)) {
    throw Errors.conflict("Contato optou por sair (opt-out) deste canal");
  }

  const contactVars = await getContactVars(input.contactId);
  const mergedVars = { ...contactVars, ...(input.vars ?? {}) };

  let text: string | undefined;
  let subject: string | undefined;
  let html: string | undefined;
  let buttons: unknown;

  if (input.templateId) {
    const template = await prisma.template.findFirst({ where: { id: input.templateId, accountId: input.accountId } });
    if (!template) throw Errors.notFound("Template não encontrado");
    if (template.channelType !== channel.type) throw Errors.badRequest("Template não pertence ao canal informado");
    if (template.status !== "APPROVED") throw Errors.badRequest("Template ainda não aprovado");

    text = renderTemplate(template.body, mergedVars);
    if (template.subject) subject = renderTemplate(template.subject, mergedVars);
    if (template.html) html = renderTemplate(template.html, mergedVars);
    if (template.buttons) buttons = JSON.parse(template.buttons);
  } else if (input.text) {
    text = renderTemplate(input.text, mergedVars);
  } else {
    throw Errors.badRequest("Informe um texto ou um template para enviar");
  }

  if (channel.type === "WHATSAPP" && !input.templateId) {
    const open = await hasOpenWhatsAppWindow(input.channelId, input.contactId);
    if (!open) {
      throw Errors.badRequest(
        "Fora da janela de 24h do WhatsApp: use um template aprovado para iniciar a conversa"
      );
    }
  }

  const cost = await getChannelPrice(input.accountId, channel.type);

  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({
      data: {
        accountId: input.accountId,
        direction: "OUT",
        channelId: input.channelId,
        channelType: channel.type,
        contactId: input.contactId,
        conversationId: input.conversationId,
        campaignId: input.campaignId,
        source: input.source,
        body: JSON.stringify({ text, subject, html, buttons, templateId: input.templateId, vars: mergedVars }),
        status: "QUEUED",
        costCredits: cost,
        idempotencyKey: input.idempotencyKey,
      },
    });

    await debitAccount(tx, input.accountId, cost, "message.send", { refType: "Message", refId: created.id });

    return created;
  });

  const provider = getProvider(channel.type);
  const result = await provider.send({
    messageId: message.id,
    channelType: channel.type,
    contactPhone: contact.phone,
    contactEmail: contact.email,
    body: { text, subject, html, buttons },
  });

  const updated = await prisma.message.update({ where: { id: message.id }, data: { providerId: result.providerId } });

  realtimeHub.broadcast(input.accountId, "message.created", { message: updated });
  await emitMessageEvent("message.created", { message: updated });

  await scheduleFirstTransition(jobRunner, message.id);

  return updated;
}
