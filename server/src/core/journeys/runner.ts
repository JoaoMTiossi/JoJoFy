import { prisma } from "../../lib/prisma";
import { JobRunner } from "../jobs/JobRunner";
import { jobRunner } from "../jobs/instance";
import { resolveSegmentContactIds, SegmentFilter, evaluateCondition, toEvaluableContact, SegmentCondition } from "../segments/evaluator";
import { sendMessage } from "../messaging/messageService";

export const JOURNEY_STEP_JOB = "journey.step";

export type JourneyStep =
  | { type: "send"; templateId: string; channelId: string; vars?: Record<string, string>; next?: number }
  | { type: "wait"; durationMs: number }
  | ({ type: "condition"; conditionType: "replied" | "attribute"; ifTrueStepIndex: number; ifFalseStepIndex: number } & Partial<
      SegmentCondition
    >);

export interface JourneyDefinition {
  steps: JourneyStep[];
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

export async function activateJourney(journeyId: string) {
  const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
  if (!journey) return;

  const contactIds = await resolveAudienceContactIds(journey.accountId, journey.listId, journey.segmentId);

  await prisma.journey.update({ where: { id: journeyId }, data: { status: "ACTIVE" } });

  for (const contactId of contactIds) {
    const run = await prisma.journeyRun.create({
      data: { journeyId, contactId, stepIndex: 0, status: "RUNNING", nextRunAt: new Date() },
    });
    await jobRunner.enqueue(JOURNEY_STEP_JOB, { runId: run.id }, { runAt: new Date(), accountId: journey.accountId });
  }
}

/** Marca as jornadas ativas do contato como "respondeu", usado pelo passo de condição. */
export async function markContactReplied(accountId: string, contactId: string) {
  const runs = await prisma.journeyRun.findMany({
    where: { contactId, status: "RUNNING", journey: { accountId } },
  });
  for (const run of runs) {
    await prisma.journeyRun.update({ where: { id: run.id }, data: { replied: true } });
  }
}

async function processStep(runId: string) {
  const run = await prisma.journeyRun.findUnique({ where: { id: runId }, include: { journey: true, contact: true } });
  if (!run || run.status !== "RUNNING") return;

  const definition = JSON.parse(run.journey.definition) as JourneyDefinition;
  const step = definition.steps[run.stepIndex];

  if (!step) {
    await prisma.journeyRun.update({ where: { id: runId }, data: { status: "DONE" } });
    return;
  }

  if (step.type === "send") {
    try {
      await sendMessage({
        accountId: run.journey.accountId,
        contactId: run.contactId,
        channelId: step.channelId,
        source: "JOURNEY",
        templateId: step.templateId,
        vars: step.vars,
      });
    } catch {
      // segue a jornada mesmo se o envio falhar (ex.: opt-out, sem crédito)
    }
    await advance(runId, step.next ?? run.stepIndex + 1, new Date(), run.journey.accountId);
    return;
  }

  if (step.type === "wait") {
    const nextRunAt = new Date(Date.now() + step.durationMs);
    await prisma.journeyRun.update({ where: { id: runId }, data: { stepIndex: run.stepIndex + 1, nextRunAt } });
    await jobRunner.enqueue(JOURNEY_STEP_JOB, { runId }, { runAt: nextRunAt, accountId: run.journey.accountId });
    return;
  }

  if (step.type === "condition") {
    let isTrue: boolean;
    if (step.conditionType === "replied") {
      isTrue = run.replied;
    } else {
      const contactFull = await prisma.contact.findUnique({
        where: { id: run.contactId },
        include: { attributeValues: { include: { def: true } } },
      });
      const evaluable = toEvaluableContact(contactFull!);
      isTrue = evaluateCondition(evaluable, {
        attr: step.attr!,
        op: step.op!,
        value: step.value,
      });
    }
    const nextIndex = isTrue ? step.ifTrueStepIndex : step.ifFalseStepIndex;
    await advance(runId, nextIndex, new Date(), run.journey.accountId);
    return;
  }
}

async function advance(runId: string, nextStepIndex: number, runAt: Date, accountId: string) {
  await prisma.journeyRun.update({ where: { id: runId }, data: { stepIndex: nextStepIndex, nextRunAt: runAt } });
  await jobRunner.enqueue(JOURNEY_STEP_JOB, { runId }, { runAt, accountId });
}

export function registerJourneyJobs(runner: JobRunner) {
  runner.register(JOURNEY_STEP_JOB, async (payload: { runId: string }) => processStep(payload.runId));
}
