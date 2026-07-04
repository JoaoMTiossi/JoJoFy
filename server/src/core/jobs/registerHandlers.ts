import { JobRunner } from "./JobRunner";

/**
 * Ponto único de registro dos handlers de Job. Cada milestone acrescenta os
 * seus tipos aqui (transições de status de mensagem, lotes de campanha,
 * passos de jornada, reentrega de webhook, etc.).
 */
export function registerJobHandlers(_jobRunner: JobRunner) {
  // Handlers são registrados progressivamente pelos módulos de core/*.
}
