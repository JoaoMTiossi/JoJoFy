import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { creditAccount } from "../core/billing/creditService";
import type { JwtUser } from "../plugins/auth";

const registerSchema = z.object({
  accountName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const COURTESY_CREDITS = 1000;

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) throw Errors.conflict("E-mail já cadastrado");

    const passwordHash = await bcrypt.hash(body.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({ data: { name: body.accountName } });

      const user = await tx.user.create({
        data: {
          accountId: account.id,
          name: body.name,
          email: body.email,
          passwordHash,
          role: "ADMIN",
        },
      });

      const whatsapp = await tx.channel.create({
        data: {
          accountId: account.id,
          type: "WHATSAPP",
          name: "WhatsApp (simulado)",
          config: JSON.stringify({ simulated: true, number: "+5511999990000" }),
        },
      });
      const email = await tx.channel.create({
        data: {
          accountId: account.id,
          type: "EMAIL",
          name: "E-mail (simulado)",
          config: JSON.stringify({ simulated: true, from: "contato@acme.zenvia.dev" }),
        },
      });

      await tx.channelPrice.createMany({
        data: [
          { accountId: account.id, channelType: "WHATSAPP", credits: 3 },
          { accountId: account.id, channelType: "EMAIL", credits: 0.1 },
        ],
      });

      await creditAccount(tx, account.id, COURTESY_CREDITS, "Créditos de boas-vindas");

      return { account, user, channels: [whatsapp, email] };
    });

    const token = fastify.jwt.sign({
      sub: result.user.id,
      accountId: result.account.id,
      role: result.user.role as JwtUser["role"],
    });

    reply.code(201).send({
      token,
      user: { id: result.user.id, name: result.user.name, email: result.user.email, role: result.user.role },
      account: { id: result.account.id, name: result.account.name },
    });
  });

  fastify.post("/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) throw Errors.unauthorized("Credenciais inválidas");

    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) throw Errors.unauthorized("Credenciais inválidas");

    const token = fastify.jwt.sign({ sub: user.id, accountId: user.accountId, role: user.role as JwtUser["role"] });
    reply.send({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  });

  fastify.get("/me", { preHandler: fastify.authenticate }, async (request, reply) => {
    const jwtUser = request.user;
    const user = await prisma.user.findUnique({ where: { id: jwtUser.sub }, include: { account: true } });
    if (!user) throw Errors.notFound("Usuário não encontrado");

    reply.send({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      account: { id: user.account.id, name: user.account.name },
    });
  });
}
