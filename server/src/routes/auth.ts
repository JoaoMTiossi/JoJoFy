import type { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { badRequest, unauthorized } from "../lib/http-error.js";

const registerSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(user: { id: string; email: string; name: string }) {
  return { id: user.id, email: user.email, name: user.name };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/register", async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw badRequest("E-mail já cadastrado");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash },
    });

    const token = app.jwt.sign(publicUser(user));
    reply.code(201).send({ token, user: publicUser(user) });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw badRequest("Dados inválidos", parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw unauthorized("E-mail ou senha inválidos");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw unauthorized("E-mail ou senha inválidos");
    }

    const token = app.jwt.sign(publicUser(user));
    reply.send({ token, user: publicUser(user) });
  });

  app.get("/me", { onRequest: [app.authenticate] }, async (request, reply) => {
    const payload = request.user;
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      throw unauthorized();
    }
    reply.send({ user: publicUser(user) });
  });
}
