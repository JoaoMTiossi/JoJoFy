import { prisma } from "../../lib/prisma";
import { JobRunner } from "./JobRunner";

/** Singleton único do JobRunner, compartilhado por toda a aplicação (core/*
 * enfileira jobs aqui; index.ts inicia o tick). */
export const jobRunner = new JobRunner(prisma);
