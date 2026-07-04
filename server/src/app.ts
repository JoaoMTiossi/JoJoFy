import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import authPlugin from "./plugins/auth";
import apiKeyAuthPlugin from "./plugins/apiKeyAuth";
import websocketPlugin from "./plugins/websocket";
import authRoutes from "./routes/auth";
import reportsRoutes from "./routes/reports";
import contactsRoutes from "./routes/contacts";
import listsRoutes from "./routes/lists";
import segmentsRoutes from "./routes/segments";
import channelsRoutes from "./routes/channels";
import templatesRoutes from "./routes/templates";
import apiKeysRoutes from "./routes/apikeys";
import webhooksRoutes from "./routes/webhooks";
import simulatorRoutes from "./routes/simulator";
import publicMessagesRoutes from "./api/messages";
import campaignsRoutes from "./routes/campaigns";
import journeysRoutes from "./routes/journeys";
import flowsRoutes from "./routes/flows";
import queuesRoutes from "./routes/queues";
import conversationsRoutes from "./routes/conversations";
import quickRepliesRoutes from "./routes/quickreplies";
import agentStatusRoutes from "./routes/agentStatus";
import supervisionRoutes from "./routes/supervision";
import billingRoutes from "./routes/billing";
import { initWebhookListener } from "./core/webhooks/dispatcher";
import { AppError } from "./lib/errors";

export interface BuildOptions {
  enableWebsocket?: boolean;
}

export function build(opts: BuildOptions = {}): FastifyInstance {
  const fastify = Fastify({ logger: false });

  initWebhookListener();

  fastify.register(cors, { origin: true });
  fastify.register(authPlugin);
  fastify.register(apiKeyAuthPlugin);
  if (opts.enableWebsocket !== false) {
    fastify.register(websocketPlugin);
  }

  fastify.register(authRoutes, { prefix: "/auth" });
  fastify.register(reportsRoutes, { prefix: "/reports" });
  fastify.register(contactsRoutes, { prefix: "/contacts" });
  fastify.register(listsRoutes, { prefix: "/lists" });
  fastify.register(segmentsRoutes, { prefix: "/segments" });
  fastify.register(channelsRoutes, { prefix: "/channels" });
  fastify.register(templatesRoutes, { prefix: "/templates" });
  fastify.register(apiKeysRoutes, { prefix: "/api-keys" });
  fastify.register(webhooksRoutes, { prefix: "/webhooks" });
  fastify.register(simulatorRoutes, { prefix: "/simulator" });
  fastify.register(publicMessagesRoutes, { prefix: "/v1" });
  fastify.register(campaignsRoutes, { prefix: "/campaigns" });
  fastify.register(journeysRoutes, { prefix: "/journeys" });
  fastify.register(flowsRoutes, { prefix: "/flows" });
  fastify.register(queuesRoutes, { prefix: "/queues" });
  fastify.register(conversationsRoutes, { prefix: "/conversations" });
  fastify.register(quickRepliesRoutes, { prefix: "/quick-replies" });
  fastify.register(agentStatusRoutes, { prefix: "/agent-status" });
  fastify.register(supervisionRoutes, { prefix: "/supervision" });
  fastify.register(billingRoutes, { prefix: "/billing" });

  fastify.get("/health", async () => ({ ok: true }));

  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      reply.code(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      reply.code(400).send({ error: "VALIDATION_ERROR", message: error.issues.map((i) => i.message).join("; "), issues: error.issues });
      return;
    }
    // @ts-ignore - zod parse errors thrown directly also match name
    if (error?.name === "ZodError") {
      reply.code(400).send({ error: "VALIDATION_ERROR", message: String(error.message) });
      return;
    }
    const statusCode = (error as any).statusCode ?? 500;
    reply.code(statusCode).send({ error: "INTERNAL_ERROR", message: statusCode === 500 ? "Erro interno" : error.message });
  });

  return fastify;
}
