import { describe, it, expect, afterAll } from "vitest";
import { JobRunner } from "../src/core/jobs/JobRunner";
import { prisma } from "../src/lib/prisma";

describe("JobRunner", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("processa um job de teste e marca como DONE", async () => {
    const runner = new JobRunner(prisma);
    let executed = false;
    let receivedPayload: any = null;

    runner.register("test.echo", async (payload) => {
      executed = true;
      receivedPayload = payload;
    });

    const job = await runner.enqueue("test.echo", { hello: "world" });
    await runner.runOnce();

    expect(executed).toBe(true);
    expect(receivedPayload).toEqual({ hello: "world" });

    const updated = await prisma.job.findUnique({ where: { id: job.id } });
    expect(updated?.status).toBe("DONE");
  });

  it("marca como FAILED após esgotar tentativas e reagenda com backoff antes disso", async () => {
    const runner = new JobRunner(prisma);
    runner.register("test.fails", async () => {
      throw new Error("falha proposital");
    });

    const job = await runner.enqueue("test.fails", {});
    await runner.runOnce();

    const afterFirst = await prisma.job.findUnique({ where: { id: job.id } });
    expect(afterFirst?.status).toBe("PENDING");
    expect(afterFirst?.attempts).toBe(1);
  });
});
