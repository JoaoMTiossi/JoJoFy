import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";

export default async function userRoutes(app: FastifyInstance) {
  app.get("/users", { onRequest: [app.authenticate] }, async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
    reply.send({ users });
  });
}
