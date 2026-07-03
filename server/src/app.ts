import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import { HttpError } from "./lib/http-error.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  app.get("/api/health", async () => ({ status: "ok" }));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) {
      reply.code(error.statusCode).send({ error: error.message, details: error.details });
      return;
    }
    if (error instanceof ZodError) {
      reply.code(400).send({ error: "Validation error", details: error.flatten() });
      return;
    }
    if ((error as any).statusCode) {
      reply.code((error as any).statusCode).send({ error: error.message });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(error);
    reply.code(500).send({ error: "Internal server error" });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send({ error: "Not found" });
  });

  return app;
}
