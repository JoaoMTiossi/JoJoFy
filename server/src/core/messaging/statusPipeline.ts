import { prisma } from "../../lib/prisma";
import { JobRunner } from "../jobs/JobRunner";
import { creditAccount } from "../billing/creditService";
import { emitMessageEvent } from "./hooks";
import { realtimeHub } from "../realtime/hub";

/** Transições realistas de status simuladas para qualquer mensagem OUT:
 * QUEUED → SENT (+1s) → DELIVERED (+3s) → READ (+10s), com ~3% de chance de
 * falha em cada etapa (estorna os créditos debitados). */
const STEPS = [
  { status: "SENT", delayMs: 1000 },
  { status: "DELIVERED", delayMs: 3000 },
  { status: "READ", delayMs: 10000 },
];

const FAILURE_RATE = 0.03;
export const MESSAGE_TRANSITION_JOB = "message.transition";

interface TransitionPayload {
  messageId: string;
  stepIndex: number;
}

export function scheduleFirstTransition(jobRunner: JobRunner, messageId: string) {
  return jobRunner.enqueue(
    MESSAGE_TRANSITION_JOB,
    { messageId, stepIndex: 0 } as TransitionPayload,
    { runAt: new Date(Date.now() + STEPS[0].delayMs) }
  );
}

export function registerMessagingJobs(jobRunner: JobRunner) {
  jobRunner.register(MESSAGE_TRANSITION_JOB, async (payload: TransitionPayload) => {
    const message = await prisma.message.findUnique({ where: { id: payload.messageId } });
    if (!message) return;
    if (message.status === "FAILED" || message.status === "READ") return; // terminal

    const step = STEPS[payload.stepIndex];
    if (!step) return;

    const shouldFail = Math.random() < FAILURE_RATE;

    if (shouldFail) {
      const balanceAfter = await creditAccount(prisma, message.accountId, message.costCredits, "message.failed_refund", {
        refType: "Message",
        refId: message.id,
      });
      const updated = await prisma.message.update({
        where: { id: message.id },
        data: { status: "FAILED", statusAt: new Date() },
      });
      realtimeHub.broadcast(message.accountId, "message.updated", { message: updated, balanceAfter });
      await emitMessageEvent("message.status", { message: updated });
      return;
    }

    const updated = await prisma.message.update({
      where: { id: message.id },
      data: { status: step.status, statusAt: new Date() },
    });
    realtimeHub.broadcast(message.accountId, "message.updated", { message: updated });
    await emitMessageEvent("message.status", { message: updated });

    const nextIndex = payload.stepIndex + 1;
    const nextStep = STEPS[nextIndex];
    if (nextStep) {
      await jobRunner.enqueue(
        MESSAGE_TRANSITION_JOB,
        { messageId: message.id, stepIndex: nextIndex } as TransitionPayload,
        { runAt: new Date(Date.now() + nextStep.delayMs), accountId: message.accountId }
      );
    }
  });
}
