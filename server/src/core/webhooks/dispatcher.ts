import { prisma } from "../../lib/prisma";
import { JobRunner } from "../jobs/JobRunner";
import { jobRunner } from "../jobs/instance";
import { signHmac } from "../../lib/hmac";
import { onMessageEvent, DomainEvent } from "../messaging/hooks";

export const WEBHOOK_DELIVER_JOB = "webhook.deliver";

/** Backoff de reentrega: 1m, 5m, 30m, 2h — depois disso, descarta. */
const RETRY_SCHEDULE_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

const EVENT_MAP: Record<string, string> = {
  "message.created": "message.status",
  "message.status": "message.status",
  "message.received": "message.received",
  "contact.optout": "contact.optout",
};

async function dispatchEvent(accountId: string, event: string, payload: unknown) {
  const webhooks = await prisma.webhook.findMany({ where: { accountId, active: true } });
  for (const webhook of webhooks) {
    const events = webhook.events.split(",").map((e) => e.trim());
    if (!events.includes(event)) continue;

    const delivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: webhook.id,
        event,
        payload: JSON.stringify({ event, data: payload, at: new Date().toISOString() }),
      },
    });

    await jobRunner.enqueue(WEBHOOK_DELIVER_JOB, { deliveryId: delivery.id }, { runAt: new Date(), accountId });
  }
}

let listenerInitialized = false;

/** Liga o dispatcher aos eventos de domínio (mensagens e opt-out). Idempotente. */
export function initWebhookListener() {
  if (listenerInitialized) return;
  listenerInitialized = true;

  onMessageEvent(async (event: DomainEvent, payload: any) => {
    const mapped = EVENT_MAP[event];
    if (!mapped) return;
    const accountId = payload?.message?.accountId ?? payload?.optOut?.accountId;
    if (!accountId) return;
    await dispatchEvent(accountId, mapped, payload);
  });
}

export function registerWebhookJobs(runner: JobRunner) {
  runner.register(WEBHOOK_DELIVER_JOB, async (payload: { deliveryId: string }) => {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: payload.deliveryId },
      include: { webhook: true },
    });
    if (!delivery || delivery.status === "DELIVERED") return;

    const signature = signHmac(delivery.webhook.secret, delivery.payload);

    try {
      const res = await fetch(delivery.webhook.url, {
        method: "POST",
        headers: { "content-type": "application/json", "X-Signature": signature },
        body: delivery.payload,
      });

      if (res.status >= 200 && res.status < 300) {
        await prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: { status: "DELIVERED", lastStatus: res.status, attempts: { increment: 1 } },
        });
      } else {
        await scheduleRetry(delivery.id, delivery.webhook.accountId, delivery.attempts, res.status, `HTTP ${res.status}`);
      }
    } catch (err: any) {
      await scheduleRetry(delivery.id, delivery.webhook.accountId, delivery.attempts, undefined, String(err?.message ?? err));
    }
  });
}

async function scheduleRetry(
  deliveryId: string,
  accountId: string,
  previousAttempts: number,
  lastStatus: number | undefined,
  lastError: string
) {
  const attempts = previousAttempts + 1;
  const delayMs = RETRY_SCHEDULE_MS[attempts - 1];

  if (delayMs === undefined) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: "FAILED", attempts, lastStatus, lastError },
    });
    return;
  }

  const nextRetryAt = new Date(Date.now() + delayMs);
  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: { status: "PENDING", attempts, lastStatus, lastError, nextRetryAt },
  });
  await jobRunner.enqueue(WEBHOOK_DELIVER_JOB, { deliveryId }, { runAt: nextRetryAt, accountId });
}
