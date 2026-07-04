import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import { FastifyReply, FastifyRequest } from "fastify";

export interface JwtUser {
  sub: string; // userId
  accountId: string;
  role: "ADMIN" | "MANAGER" | "AGENT" | "DEVELOPER";
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (...roles: JwtUser["role"][]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export default fp(async function authPlugin(fastify) {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-me",
  });

  fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ error: "UNAUTHORIZED", message: "Token inválido ou ausente" });
    }
  });

  fastify.decorate("requireRole", function (...roles: JwtUser["role"][]) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      const user = request.user as JwtUser | undefined;
      if (!user || !roles.includes(user.role)) {
        reply.code(403).send({ error: "FORBIDDEN", message: "Sem permissão para este recurso" });
      }
    };
  });
});
