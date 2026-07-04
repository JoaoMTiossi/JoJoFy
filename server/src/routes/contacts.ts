import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { Errors } from "../lib/errors";
import { toE164, isValidE164 } from "../lib/e164";
import { importContactsFromCsv } from "../core/contacts/csvImport";
import { createOptOut, isOptedOut } from "../core/contacts/optOutService";

const contactSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  attributes: z.record(z.string()).optional(),
});

const attributeDefSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["TEXT", "NUMBER", "DATE", "SELECT"]),
  options: z.array(z.string()).optional(),
});

const importSchema = z.object({
  csv: z.string().min(1),
  mapping: z.object({
    name: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    attributes: z.record(z.string()).optional(),
  }),
  listId: z.string().optional(),
});

const optOutSchema = z.object({
  channelType: z.enum(["WHATSAPP", "EMAIL"]),
  reason: z.string().optional(),
});

export default async function contactsRoutes(fastify: FastifyInstance) {
  fastify.addHook("preHandler", fastify.authenticate);

  fastify.get("/attributes", async (request) => {
    const accountId = request.user.accountId;
    const defs = await prisma.attributeDef.findMany({ where: { accountId } });
    return defs;
  });

  fastify.post(
    "/attributes",
    { preHandler: fastify.requireRole("ADMIN", "MANAGER") },
    async (request, reply) => {
      const accountId = request.user.accountId;
      const body = attributeDefSchema.parse(request.body);
      const existing = await prisma.attributeDef.findUnique({
        where: { accountId_name: { accountId, name: body.name } },
      });
      if (existing) throw Errors.conflict("Já existe um atributo com esse nome");
      const def = await prisma.attributeDef.create({
        data: { accountId, name: body.name, type: body.type, options: body.options?.join(",") },
      });
      reply.code(201).send(def);
    }
  );

  fastify.get("/", async (request) => {
    const accountId = request.user.accountId;
    const q = (request.query as any)?.q as string | undefined;
    const contacts = await prisma.contact.findMany({
      where: {
        accountId,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { phone: { contains: q } },
                { email: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: { attributeValues: { include: { def: true } } },
      take: 200,
    });
    return contacts;
  });

  fastify.post("/", async (request, reply) => {
    const accountId = request.user.accountId;
    const body = contactSchema.parse(request.body);
    const phone = body.phone ? toE164(body.phone) : undefined;
    if (phone && !isValidE164(phone)) throw Errors.badRequest("Telefone inválido");

    const contact = await prisma.contact.create({
      data: { accountId, name: body.name, phone, email: body.email },
    });

    if (body.attributes) {
      await setContactAttributes(accountId, contact.id, body.attributes);
    }

    const full = await prisma.contact.findUnique({
      where: { id: contact.id },
      include: { attributeValues: { include: { def: true } } },
    });
    reply.code(201).send(full);
  });

  fastify.get("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const contact = await prisma.contact.findFirst({
      where: { id, accountId },
      include: { attributeValues: { include: { def: true } }, optOuts: true },
    });
    if (!contact) throw Errors.notFound("Contato não encontrado");

    const messages = await prisma.message.findMany({
      where: { accountId, contactId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return { ...contact, timeline: messages };
  });

  fastify.patch("/:id", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const body = contactSchema.partial().parse(request.body);

    const existing = await prisma.contact.findFirst({ where: { id, accountId } });
    if (!existing) throw Errors.notFound("Contato não encontrado");

    const phone = body.phone ? toE164(body.phone) : undefined;
    if (phone && !isValidE164(phone)) throw Errors.badRequest("Telefone inválido");

    await prisma.contact.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
      },
    });

    if (body.attributes) {
      await setContactAttributes(accountId, id, body.attributes);
    }

    return prisma.contact.findUnique({ where: { id }, include: { attributeValues: { include: { def: true } } } });
  });

  fastify.delete("/:id", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const existing = await prisma.contact.findFirst({ where: { id, accountId } });
    if (!existing) throw Errors.notFound("Contato não encontrado");

    await prisma.$transaction([
      prisma.attributeValue.deleteMany({ where: { contactId: id } }),
      prisma.listMember.deleteMany({ where: { contactId: id } }),
      prisma.optOut.deleteMany({ where: { contactId: id } }),
      prisma.contact.delete({ where: { id } }),
    ]);

    reply.code(204).send();
  });

  fastify.post("/:id/optout", async (request, reply) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const body = optOutSchema.parse(request.body);
    const contact = await prisma.contact.findFirst({ where: { id, accountId } });
    if (!contact) throw Errors.notFound("Contato não encontrado");

    const optOut = await createOptOut(accountId, id, body.channelType, body.reason);
    reply.code(201).send(optOut);
  });

  fastify.get("/:id/optouts", async (request) => {
    const accountId = request.user.accountId;
    const { id } = request.params as { id: string };
    const contact = await prisma.contact.findFirst({ where: { id, accountId } });
    if (!contact) throw Errors.notFound("Contato não encontrado");
    return prisma.optOut.findMany({ where: { contactId: id } });
  });

  fastify.get("/:id/optout/:channelType", async (request) => {
    const { id, channelType } = request.params as { id: string; channelType: string };
    return { optedOut: await isOptedOut(id, channelType) };
  });

  fastify.post("/import", { preHandler: fastify.requireRole("ADMIN", "MANAGER") }, async (request, reply) => {
    const accountId = request.user.accountId;
    const body = importSchema.parse(request.body);
    if (body.listId) {
      const list = await prisma.list.findFirst({ where: { id: body.listId, accountId } });
      if (!list) throw Errors.notFound("Lista não encontrada");
    }
    const report = await importContactsFromCsv(accountId, body.csv, body.mapping, body.listId);
    reply.send(report);
  });
}

async function setContactAttributes(accountId: string, contactId: string, attributes: Record<string, string>) {
  for (const [name, value] of Object.entries(attributes)) {
    const def = await prisma.attributeDef.findUnique({ where: { accountId_name: { accountId, name } } });
    if (!def) continue;
    await prisma.attributeValue.upsert({
      where: { contactId_defId: { contactId, defId: def.id } },
      update: { value },
      create: { contactId, defId: def.id, value },
    });
  }
}
