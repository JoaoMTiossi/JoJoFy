import { prisma } from "../../lib/prisma";
import { JobRunner } from "../jobs/JobRunner";
import { jobRunner } from "../jobs/instance";
import { isOptedOut } from "../contacts/optOutService";
import { resolveSegmentContactIds, SegmentFilter } from "../segments/evaluator";
import { sendMessage } from "../messaging/messageService";

export const CAMPAIGN_START_JOB = "campaign.start";
export const CAMPAIGN_BATCH_JOB = "campaign.process_batch";

const BATCH_SIZE = 50;
const BATCH_INTERVAL_MS = 300; // controle de vazão entre lotes

export async function enqueueCampaignStart(campaignId: string, accountId: string, runAt: Date) {
  await jobRunner.enqueue(CAMPAIGN_START_JOB, { campaignId }, { runAt, accountId });
}

async function resolveAudienceContactIds(accountId: string, listId: string | null, segmentId: string | null) {
  if (listId) {
    const members = await prisma.listMember.findMany({ where: { listId }, select: { contactId: true } });
    return [...new Set(members.map((m) => m.contactId))];
  }
  if (segmentId) {
    const segment = await prisma.segment.findFirst({ where: { id: segmentId, accountId } });
    if (!segment) return [];
    const filter = JSON.parse(segment.filter) as SegmentFilter;
    return resolveSegmentContactIds(accountId, filter);
  }
  return [];
}

async function startCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status === "CANCELED") return;

  const contactIds = await resolveAudienceContactIds(campaign.accountId, campaign.listId, campaign.segmentId);

  // exclui opt-outs do canal da campanha
  const eligible: string[] = [];
  for (const contactId of contactIds) {
    const optedOut = await isOptedOut(contactId, campaign.channelType);
    if (!optedOut) eligible.push(contactId);
  }

  for (const contactId of eligible) {
    const variant = campaign.variantBId && campaign.variantPct && Math.random() * 100 < campaign.variantPct ? "B" : "A";
    await prisma.campaignRecipient
      .create({ data: { campaignId: campaign.id, contactId, variant } })
      .catch(() => undefined); // já existe (idempotência em reprocessamentos)
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "RUNNING", totalCount: eligible.length },
  });

  await jobRunner.enqueue(CAMPAIGN_BATCH_JOB, { campaignId }, { runAt: new Date(), accountId: campaign.accountId });
}

async function processBatch(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "RUNNING") return;

  const batch = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    take: BATCH_SIZE,
  });

  let sentDelta = 0;
  let failedDelta = 0;

  for (const recipient of batch) {
    const optedOut = await isOptedOut(recipient.contactId, campaign.channelType);
    if (optedOut) {
      await prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: "SKIPPED" } });
      continue;
    }

    const templateId = recipient.variant === "B" && campaign.variantBId ? campaign.variantBId : campaign.templateId;
    const vars = campaign.variables ? JSON.parse(campaign.variables) : undefined;

    try {
      const message = await sendMessage({
        accountId: campaign.accountId,
        contactId: recipient.contactId,
        channelId: campaign.channelId,
        source: "CAMPAIGN",
        campaignId: campaign.id,
        templateId,
        vars,
      });
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: { status: "SENT", messageId: message.id },
      });
      sentDelta++;
    } catch {
      await prisma.campaignRecipient.update({ where: { id: recipient.id }, data: { status: "SKIPPED" } });
      failedDelta++;
    }
  }

  if (sentDelta || failedDelta) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { sentCount: { increment: sentDelta }, failedCount: { increment: failedDelta } },
    });
  }

  const remaining = await prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } });
  if (remaining > 0) {
    await jobRunner.enqueue(
      CAMPAIGN_BATCH_JOB,
      { campaignId },
      { runAt: new Date(Date.now() + BATCH_INTERVAL_MS), accountId: campaign.accountId }
    );
  } else {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "DONE" } });
  }
}

export function registerCampaignJobs(runner: JobRunner) {
  runner.register(CAMPAIGN_START_JOB, async (payload: { campaignId: string }) => startCampaign(payload.campaignId));
  runner.register(CAMPAIGN_BATCH_JOB, async (payload: { campaignId: string }) => processBatch(payload.campaignId));
}

/** Relatório agregado por status das mensagens desta campanha — sempre
 * recalculado a partir da tabela Message, garantindo que os números batem. */
export async function getCampaignReport(campaignId: string) {
  const [campaign, recipients, messagesByStatus] = await Promise.all([
    prisma.campaign.findUnique({ where: { id: campaignId } }),
    prisma.campaignRecipient.findMany({ where: { campaignId } }),
    prisma.message.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of messagesByStatus) statusCounts[row.status] = row._count._all;

  const variantCounts = { A: 0, B: 0 };
  for (const r of recipients) variantCounts[r.variant as "A" | "B"]++;

  return {
    campaign,
    totalRecipients: recipients.length,
    skipped: recipients.filter((r) => r.status === "SKIPPED").length,
    variantCounts,
    messagesByStatus: statusCounts,
    totalMessages: messagesByStatus.reduce((acc, r) => acc + r._count._all, 0),
  };
}
