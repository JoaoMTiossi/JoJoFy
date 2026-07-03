import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  await prisma.activity.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.cardLabel.deleteMany();
  await prisma.cardAssignee.deleteMany();
  await prisma.fieldValue.deleteMany();
  await prisma.card.deleteMany();
  await prisma.label.deleteMany();
  await prisma.field.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.pipe.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demoUser = await prisma.user.create({
    data: { name: "Demo", email: "demo@jojofy.dev", passwordHash },
  });
  const anaUser = await prisma.user.create({
    data: {
      name: "Ana Souza",
      email: "ana@jojofy.dev",
      passwordHash: await bcrypt.hash("demo1234", 10),
    },
  });

  const pipe = await prisma.pipe.create({
    data: {
      name: "Suporte",
      icon: "🎧",
      color: "#3b82f6",
    },
  });

  const [triagem, andamento, aguardando, concluido] = await Promise.all([
    prisma.phase.create({ data: { pipeId: pipe.id, name: "Triagem", position: 0 } }),
    prisma.phase.create({ data: { pipeId: pipe.id, name: "Em andamento", position: 1 } }),
    prisma.phase.create({ data: { pipeId: pipe.id, name: "Aguardando cliente", position: 2 } }),
    prisma.phase.create({
      data: { pipeId: pipe.id, name: "Concluído", position: 3, isDone: true },
    }),
  ]);

  const [clienteField, prioridadeField, prazoField] = await Promise.all([
    prisma.field.create({
      data: {
        pipeId: pipe.id,
        label: "Cliente",
        type: "text",
        required: true,
        position: 0,
      },
    }),
    prisma.field.create({
      data: {
        pipeId: pipe.id,
        label: "Prioridade",
        type: "select",
        required: true,
        options: JSON.stringify(["Baixa", "Média", "Alta"]),
        position: 1,
      },
    }),
    prisma.field.create({
      data: {
        pipeId: pipe.id,
        label: "Descrição",
        type: "textarea",
        required: false,
        position: 2,
      },
    }),
  ]);

  const [urgenteLabel, bugLabel] = await Promise.all([
    prisma.label.create({ data: { pipeId: pipe.id, name: "Urgente", color: "#ef4444" } }),
    prisma.label.create({ data: { pipeId: pipe.id, name: "Bug", color: "#8b5cf6" } }),
  ]);

  const cardsSeed = [
    {
      phase: triagem,
      title: "Login não funciona",
      cliente: "Empresa A",
      prioridade: "Alta",
      descricao: "Cliente não consegue acessar o painel.",
      labels: [urgenteLabel, bugLabel],
      assignees: [demoUser],
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      phase: triagem,
      title: "Dúvida sobre fatura",
      cliente: "Empresa B",
      prioridade: "Baixa",
      descricao: "Cliente quer entender cobrança duplicada.",
      labels: [],
      assignees: [],
      dueDate: null,
    },
    {
      phase: andamento,
      title: "Erro ao exportar relatório",
      cliente: "Empresa C",
      prioridade: "Média",
      descricao: "Exportação trava em 80%.",
      labels: [bugLabel],
      assignees: [anaUser],
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      phase: andamento,
      title: "Solicitação de novo usuário",
      cliente: "Empresa D",
      prioridade: "Baixa",
      descricao: "",
      labels: [],
      assignees: [demoUser, anaUser],
      dueDate: null,
    },
    {
      phase: aguardando,
      title: "Aguardando print do erro",
      cliente: "Empresa E",
      prioridade: "Média",
      descricao: "Pedimos print para reproduzir o bug.",
      labels: [bugLabel],
      assignees: [anaUser],
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
    },
    {
      phase: concluido,
      title: "Reset de senha",
      cliente: "Empresa F",
      prioridade: "Baixa",
      descricao: "Resolvido via link de redefinição.",
      labels: [],
      assignees: [demoUser],
      dueDate: null,
    },
  ];

  const positionByPhase: Record<string, number> = {};

  for (const seedCard of cardsSeed) {
    const position = positionByPhase[seedCard.phase.id] ?? 0;
    positionByPhase[seedCard.phase.id] = position + 1;

    const card = await prisma.card.create({
      data: {
        phaseId: seedCard.phase.id,
        title: seedCard.title,
        position,
        dueDate: seedCard.dueDate,
        values: {
          create: [
            { fieldId: clienteField.id, value: seedCard.cliente },
            { fieldId: prioridadeField.id, value: seedCard.prioridade },
            ...(seedCard.descricao
              ? [{ fieldId: prazoField.id, value: seedCard.descricao }]
              : []),
          ],
        },
        labels: {
          create: seedCard.labels.map((label) => ({ labelId: label.id })),
        },
        assignees: {
          create: seedCard.assignees.map((user) => ({ userId: user.id })),
        },
      },
    });

    await prisma.activity.create({
      data: {
        cardId: card.id,
        actorName: "Demo",
        type: "created",
        detail: `criou o card "${card.title}"`,
      },
    });
  }

  console.log("Seed complete:");
  console.log("  demo user: demo@jojofy.dev / demo1234");
  console.log(`  pipe: ${pipe.name} (${pipe.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
