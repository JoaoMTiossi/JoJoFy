import { prisma } from "../../lib/prisma";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Janela de sessão do WhatsApp: só permite texto livre se o contato
 * respondeu nas últimas 24h neste canal; senão exige template aprovado. */
export async function hasOpenWhatsAppWindow(channelId: string, contactId: string): Promise<boolean> {
  const lastInbound = await prisma.message.findFirst({
    where: { channelId, contactId, direction: "IN" },
    orderBy: { createdAt: "desc" },
  });
  if (!lastInbound) return false;
  return Date.now() - lastInbound.createdAt.getTime() < WINDOW_MS;
}
