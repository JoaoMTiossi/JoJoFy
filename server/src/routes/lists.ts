import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";

const listSchema = z.object({ name: z.string().min(1) });
const memberSchema = z.object({ contactId: z.string() });

export default async function listsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);
  fastify.addHook("preHandler", fastify.requireRole("ADMIN", "MANAGER"));

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    const lists = await prisma.list.findMany({
      where: { accountId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { members: true } } },
    });
    return lists;
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = listSchema.parse(request.body);
    const list = await prisma.list.create({ data: { accountId, name: body.name } });
    reply.code(201).send(list);
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const list = await prisma.list.findFirst({ where: { id, accountId }, include: { _count: { select: { members: true } } } });
    if (!list) throw Errors.notFound("Lista não encontrada");
    return list;
  });

  fastify.get("/:id/members", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const list = await prisma.list.findFirst({ where: { id, accountId } });
    if (!list) throw Errors.notFound("Lista não encontrada");
    const members = await prisma.listMember.findMany({
      where: { listId: id },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
    });
    return members.map((m) => m.contact);
  });

  fastify.post("/:id/members", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const body = memberSchema.parse(request.body);
    const list = await prisma.list.findFirst({ where: { id, accountId } });
    if (!list) throw Errors.notFound("Lista não encontrada");
    const contact = await prisma.contact.findFirst({ where: { id: body.contactId, accountId } });
    if (!contact) throw Errors.notFound("Contato não encontrado");

    const member = await prisma.listMember.upsert({
      where: { listId_contactId: { listId: id, contactId: body.contactId } },
      update: {},
      create: { listId: id, contactId: body.contactId },
    });
    reply.code(201).send(member);
  });

  fastify.delete("/:id/members/:contactId", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id, contactId } = request.params as { id: string; contactId: string };
    const list = await prisma.list.findFirst({ where: { id, accountId } });
    if (!list) throw Errors.notFound("Lista não encontrada");
    await prisma.listMember.deleteMany({ where: { listId: id, contactId } });
    reply.code(204).send();
  });

  fastify.delete("/:id", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const list = await prisma.list.findFirst({ where: { id, accountId } });
    if (!list) throw Errors.notFound("Lista não encontrada");
    await prisma.listMember.deleteMany({ where: { listId: id } });
    await prisma.list.delete({ where: { id } });
    reply.code(204).send();
  });
}
