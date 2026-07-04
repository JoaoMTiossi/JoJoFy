import { prisma } from "../../lib/prisma";

export async function isOptedOut(contactId: string, channelType: string): Promise<boolean> {
  const optOut = await prisma.optOut.findUnique({
    where: { contactId_channelType: { contactId, channelType } },
  });
  return !!optOut;
}

export async function createOptOut(accountId: string, contactId: string, channelType: string, reason?: string) {
  return prisma.optOut.upsert({
    where: { contactId_channelType: { contactId, channelType } },
    update: { reason },
    create: { accountId, contactId, channelType, reason },
  });
}
