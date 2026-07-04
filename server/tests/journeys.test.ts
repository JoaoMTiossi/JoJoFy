import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { build } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { FastifyInstance } from "fastify";
import { registerTestAccount, getChannel } from "./helpers";
import { jobRunner } from "../src/core/jobs/instance";
import { handleInbound } from "../src/core/inbound/router";

describe("jornadas automatizadas", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = build({ enableWebsocket: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  async function drainJobs(maxTicks = 10) {
    for (let i = 0; i < maxTicks; i++) {
      await prisma.job.updateMany({ where: { status: "PENDING" }, data: { runAt: new Date() } });
      await jobRunner.runOnce();
      const pending = await prisma.job.count({ where: { status: "PENDING" } });
      if (pending === 0) break;
    }
  }

  async function setup(suffix: string) {
    const { token, accountId } = await registerTestAccount(app, suffix);
    const channel = await getChannel(accountId, "EMAIL");
    const template = await prisma.template.create({
      data: {
        accountId,
        channelId: channel.id,
        channelType: "EMAIL",
        name: "Journey msg",
        body: "Olá {{nome}}, ainda temos vaga!",
        status: "APPROVED",
      },
    });
    const repliedTemplate = await prisma.template.create({
      data: {
        accountId,
        channelId: channel.id,
        channelType: "EMAIL",
        name: "Obrigado por responder",
        body: "Que bom que respondeu, {{nome}}!",
        status: "APPROVED",
      },
    });
    const silentTemplate = await prisma.template.create({
      data: {
        accountId,
        channelId: channel.id,
        channelType: "EMAIL",
        name: "Lembrete",
        body: "{{nome}}, ainda estamos por aqui, responda quando puder.",
        status: "APPROVED",
      },
    });
    const list = await prisma.list.create({ data: { accountId, name: "Lista jornada" } });
    return { token, accountId, channel, template, repliedTemplate, silentTemplate, list };
  }

  function definitionSteps(channelId: string, templateId: string, repliedTemplateId: string, silentTemplateId: string) {
    return {
      steps: [
        { type: "send", templateId, channelId },
        { type: "wait", durationMs: 2000 },
        {
          type: "condition",
          conditionType: "replied",
          ifTrueStepIndex: 3,
          ifFalseStepIndex: 4,
        },
        { type: "send", templateId: repliedTemplateId, channelId, next: 5 }, // 3: respondeu (encerra após o envio)
        { type: "send", templateId: silentTemplateId, channelId }, // 4: não respondeu
      ],
    };
  }

  it("ramifica corretamente quando o contato responde durante a espera", async () => {
    const { token, accountId, channel, template, repliedTemplate, silentTemplate, list } = await setup(
      `journey-replied-${Date.now()}`
    );
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente Jornada", email: "j1@ex.com" } });
    await prisma.listMember.create({ data: { listId: list.id, contactId: contact.id } });

    const journeyRes = await app.inject({
      method: "POST",
      url: "/journeys",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Jornada replied",
        definition: definitionSteps(channel.id, template.id, repliedTemplate.id, silentTemplate.id),
        listId: list.id,
      },
    });
    const journey = journeyRes.json();

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);

    await app.inject({
      method: "POST",
      url: `/journeys/${journey.id}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });

    // passo 0 (send) roda imediatamente e agenda o passo 1 (wait)
    await jobRunner.runOnce();
    let run = await prisma.journeyRun.findFirst({ where: { journeyId: journey.id, contactId: contact.id } });
    expect(run?.stepIndex).toBe(1);

    // processa o passo 1 (wait): avança para a condição, mas só depois do delay
    await jobRunner.runOnce();
    run = await prisma.journeyRun.findUnique({ where: { id: run!.id } });
    expect(run?.stepIndex).toBe(2);

    // contato responde durante a espera, antes do relógio avançar
    await handleInbound({ accountId, contactId: contact.id, channelId: channel.id, text: "Sim, quero saber mais!" });

    // adianta o relógio: processa a condição (replied=true) e o send do passo 3
    await drainJobs();

    run = await prisma.journeyRun.findUnique({ where: { id: run!.id } });
    expect(run?.replied).toBe(true);
    expect(run?.stepIndex).toBe(5); // ramo "respondeu" (passo 3) pulou direto para o fim
    expect(run?.status).toBe("DONE");

    const outMessages = await prisma.message.findMany({ where: { accountId, contactId: contact.id, direction: "OUT" } });
    const templateIdsUsed = outMessages.map((m) => JSON.parse(m.body).templateId);
    expect(templateIdsUsed).toContain(repliedTemplate.id);
    expect(templateIdsUsed).not.toContain(silentTemplate.id);

    randomSpy.mockRestore();
  });

  it("ramifica para o caminho de 'não respondeu' quando o contato fica em silêncio", async () => {
    const { token, accountId, channel, template, repliedTemplate, silentTemplate, list } = await setup(
      `journey-silent-${Date.now()}`
    );
    const contact = await prisma.contact.create({ data: { accountId, name: "Cliente Silencioso", email: "j2@ex.com" } });
    await prisma.listMember.create({ data: { listId: list.id, contactId: contact.id } });

    const journeyRes = await app.inject({
      method: "POST",
      url: "/journeys",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: "Jornada silenciosa",
        definition: definitionSteps(channel.id, template.id, repliedTemplate.id, silentTemplate.id),
        listId: list.id,
      },
    });
    const journey = journeyRes.json();

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);

    await app.inject({
      method: "POST",
      url: `/journeys/${journey.id}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });

    await jobRunner.runOnce(); // passo 0 (send), agenda o passo 1 (wait)
    await jobRunner.runOnce(); // passo 1 (wait), agenda a condição para daqui a 2s

    // nenhuma resposta do contato — apenas adianta o relógio
    await drainJobs();

    const run = await prisma.journeyRun.findFirst({ where: { journeyId: journey.id, contactId: contact.id } });
    expect(run?.replied).toBe(false);
    expect(run?.stepIndex).toBe(5); // avançou após o send do passo 4 (fim da jornada)

    const outMessages = await prisma.message.findMany({ where: { accountId, contactId: contact.id, direction: "OUT" } });
    const templateIdsUsed = outMessages.map((m) => JSON.parse(m.body).templateId);
    expect(templateIdsUsed).toContain(silentTemplate.id);
    expect(templateIdsUsed).not.toContain(repliedTemplate.id);

    randomSpy.mockRestore();
  });
});
