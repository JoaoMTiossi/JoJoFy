import { prisma } from "../../lib/prisma";
import { Errors } from "../../lib/errors";
import { renderTemplate } from "../../lib/template-render";
import { sendMessage } from "../messaging/messageService";
import { evaluateCondition, toEvaluableContact, SegmentCondition } from "../segments/evaluator";
import { validateAnswer, AnswerValidation } from "./validation";
import { executeAction, ActionConfig } from "./actions";

export interface FlowNode {
  id: string;
  type: "message" | "question" | "condition" | "action" | "handoff";
  data: {
    // message
    text?: string;
    // question
    prompt?: string;
    variable?: string;
    validation?: AnswerValidation;
    invalidMessage?: string;
    // condition — usa next[0]=verdadeiro, next[1]=falso
    attr?: SegmentCondition["attr"];
    op?: SegmentCondition["op"];
    value?: SegmentCondition["value"];
    // action
    actionType?: ActionConfig["actionType"];
    tag?: string;
    listId?: string;
    url?: string;
    // handoff
    queueId?: string;
  };
  next: string[];
}

export interface FlowGraph {
  startNodeId: string;
  nodes: FlowNode[];
}

const MAX_STEPS = 30;

async function buildEvaluableContext(contactId: string, variables: Record<string, string>) {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    include: { attributeValues: { include: { def: true } } },
  });
  const evaluable = toEvaluableContact(contact!);
  for (const [key, value] of Object.entries(variables)) {
    evaluable.attributes[key] = { value, type: /^-?\d+(\.\d+)?$/.test(value) ? "NUMBER" : "TEXT" };
  }
  return evaluable;
}

async function endSession(sessionId: string, status: "DONE" | "TRANSFERRED" = "DONE") {
  await prisma.flowSession.update({ where: { id: sessionId }, data: { status, currentNodeId: null } });
}

async function runFrom(
  accountId: string,
  channelId: string,
  sessionId: string,
  graph: FlowGraph,
  nodeId: string | undefined,
  incomingText: string | undefined,
  steps = 0
): Promise<void> {
  if (!nodeId || steps > MAX_STEPS) {
    await endSession(sessionId);
    return;
  }

  const session = await prisma.flowSession.findUnique({ where: { id: sessionId } });
  if (!session || session.status !== "ACTIVE") return;

  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) {
    await endSession(sessionId);
    return;
  }

  const variables = JSON.parse(session.variables) as Record<string, string>;

  if (node.type === "question") {
    if (incomingText === undefined) {
      await sendMessage({
        accountId,
        contactId: session.contactId,
        channelId,
        source: "BOT",
        text: renderTemplate(node.data.prompt ?? "", variables),
      });
      await prisma.flowSession.update({ where: { id: sessionId }, data: { currentNodeId: node.id } });
      return;
    }

    const valid = validateAnswer(incomingText, node.data.validation);
    if (!valid) {
      await sendMessage({
        accountId,
        contactId: session.contactId,
        channelId,
        source: "BOT",
        text: node.data.invalidMessage ?? "Não entendi sua resposta, pode tentar novamente?",
      });
      return; // permanece no mesmo nó aguardando nova resposta
    }

    if (node.data.variable) {
      variables[node.data.variable] = incomingText.trim();
      await prisma.flowSession.update({ where: { id: sessionId }, data: { variables: JSON.stringify(variables) } });
    }

    return runFrom(accountId, channelId, sessionId, graph, node.next[0], undefined, steps + 1);
  }

  if (node.type === "message") {
    await sendMessage({
      accountId,
      contactId: session.contactId,
      channelId,
      source: "BOT",
      text: renderTemplate(node.data.text ?? "", variables),
    });
    return runFrom(accountId, channelId, sessionId, graph, node.next[0], undefined, steps + 1);
  }

  if (node.type === "condition") {
    const evaluable = await buildEvaluableContext(session.contactId, variables);
    const isTrue = evaluateCondition(evaluable, {
      attr: node.data.attr ?? "name",
      op: node.data.op ?? "exists",
      value: node.data.value,
    });
    const nextId = isTrue ? node.next[0] : node.next[1];
    return runFrom(accountId, channelId, sessionId, graph, nextId, undefined, steps + 1);
  }

  if (node.type === "action") {
    await executeAction(
      accountId,
      session.contactId,
      {
        actionType: node.data.actionType!,
        attr: node.data.attr,
        value: typeof node.data.value === "string" ? node.data.value : undefined,
        tag: node.data.tag,
        listId: node.data.listId,
        url: node.data.url,
      },
      variables
    );
    return runFrom(accountId, channelId, sessionId, graph, node.next[0], undefined, steps + 1);
  }

  if (node.type === "handoff") {
    const channel = await prisma.channel.findUnique({ where: { id: channelId } });
    const conversation = await prisma.conversation.create({
      data: {
        accountId,
        contactId: session.contactId,
        channelType: channel!.type,
        queueId: node.data.queueId,
        status: "OPEN",
      },
    });
    if (Object.keys(variables).length > 0) {
      await prisma.internalNote.create({
        data: {
          conversationId: conversation.id,
          authorId: "system",
          body: `Dados coletados pelo bot: ${JSON.stringify(variables)}`,
        },
      });
    }
    await endSession(sessionId, "TRANSFERRED");
    return;
  }
}

export async function startFlowSession(accountId: string, flowId: string, contactId: string, channelId: string) {
  const flow = await prisma.flow.findFirst({ where: { id: flowId, accountId } });
  if (!flow || !flow.published) throw Errors.badRequest("Fluxo não publicado");

  const session = await prisma.flowSession.create({
    data: { flowId, contactId, currentNodeId: null, variables: "{}", status: "ACTIVE" },
  });

  const graph = JSON.parse(flow.published) as FlowGraph;
  await runFrom(accountId, channelId, session.id, graph, graph.startNodeId, undefined);
  return prisma.flowSession.findUnique({ where: { id: session.id } });
}

export async function continueFlowSession(accountId: string, channelId: string, sessionId: string, incomingText: string) {
  const session = await prisma.flowSession.findUnique({ where: { id: sessionId }, include: { flow: true } });
  if (!session || session.status !== "ACTIVE" || !session.flow.published) return session;

  const graph = JSON.parse(session.flow.published) as FlowGraph;
  await runFrom(accountId, channelId, sessionId, graph, session.currentNodeId ?? undefined, incomingText);
  return prisma.flowSession.findUnique({ where: { id: sessionId } });
}
