import { JobRunner } from "./JobRunner";
import { registerMessagingJobs } from "../messaging/statusPipeline";

/**
 * Ponto único de registro dos handlers de Job. Cada milestone acrescenta os
 * seus tipos aqui (transições de status de mensagem, lotes de campanha,
 * passos de jornada, reentrega de webhook, etc.).
 */
export function registerJobHandlers(jobRunner: JobRunner) {
  registerMessagingJobs(jobRunner);
}
