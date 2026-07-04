import { build } from "./app";
import { prisma } from "./lib/prisma";
import { jobRunner } from "./core/jobs/instance";
import { registerJobHandlers } from "./core/jobs/registerHandlers";

const PORT = Number(process.env.PORT) || 3333;

async function main() {
  const fastify = build();

  registerJobHandlers(jobRunner);
  jobRunner.start(1000);

  fastify.addHook("onClose", async () => {
    jobRunner.stop();
    await prisma.$disconnect();
  });

  await fastify.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`[server] escutando em http://localhost:${PORT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
