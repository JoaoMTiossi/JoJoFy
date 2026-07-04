import { PrismaClient } from "@prisma/client";

export type JobHandler = (payload: any, job: { id: string; accountId: string | null }) => Promise<void>;

/**
 * JobRunner: loop de tick sobre a tabela `Job`. Sem broker externo — usado
 * para lotes de campanha, passos de jornada, transições de status dos
 * provedores simulados, reentrega de webhooks e agendamentos.
 */
export class JobRunner {
  private prisma: PrismaClient;
  private handlers = new Map<string, JobHandler>();
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private maxAttempts = 5;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  register(type: string, handler: JobHandler) {
    this.handlers.set(type, handler);
  }

  async enqueue(type: string, payload: unknown, opts: { runAt?: Date; accountId?: string | null } = {}) {
    return this.prisma.job.create({
      data: {
        type,
        payload: JSON.stringify(payload ?? {}),
        runAt: opts.runAt ?? new Date(),
        accountId: opts.accountId ?? null,
      },
    });
  }

  start(intervalMs = 1000) {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.tick().catch((err) => console.error("[JobRunner] tick error", err));
    }, intervalMs);
    this.timer.unref?.();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Executa uma rodada manualmente — útil em testes para não depender do timer. */
  async runOnce() {
    await this.tick();
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const due = await this.prisma.job.findMany({
        where: { status: "PENDING", runAt: { lte: now } },
        orderBy: { runAt: "asc" },
        take: 50,
      });

      for (const job of due) {
        const claim = await this.prisma.job.updateMany({
          where: { id: job.id, status: "PENDING" },
          data: { status: "RUNNING", attempts: { increment: 1 } },
        });
        if (claim.count === 0) continue; // outro worker já pegou

        const handler = this.handlers.get(job.type);
        if (!handler) {
          await this.prisma.job.update({
            where: { id: job.id },
            data: { status: "FAILED", lastError: `Sem handler para o tipo ${job.type}` },
          });
          continue;
        }

        try {
          const payload = job.payload ? JSON.parse(job.payload) : {};
          await handler(payload, { id: job.id, accountId: job.accountId });
          await this.prisma.job.update({ where: { id: job.id }, data: { status: "DONE" } });
        } catch (err: any) {
          const attempts = job.attempts + 1;
          if (attempts >= this.maxAttempts) {
            await this.prisma.job.update({
              where: { id: job.id },
              data: { status: "FAILED", lastError: String(err?.message ?? err) },
            });
          } else {
            await this.prisma.job.update({
              where: { id: job.id },
              data: {
                status: "PENDING",
                runAt: new Date(Date.now() + 2 ** attempts * 1000),
                lastError: String(err?.message ?? err),
              },
            });
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
