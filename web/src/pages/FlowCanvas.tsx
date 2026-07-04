import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { flowsApi, FlowGraphNode, FlowNodeData } from "../api/flows";
import { contactsApi } from "../api/contacts";
import { simulatorApi } from "../api/simulator";
import FlowNodeCard, { FlowNodeCardData } from "../components/flow/FlowNodeCard";

const nodeTypes = { flowNode: FlowNodeCard };

let idCounter = 1;
function newNodeId() {
  return `node-${Date.now()}-${idCounter++}`;
}

const DEFAULT_DATA: Record<string, FlowNodeData> = {
  message: { text: "Olá! Como posso ajudar?" },
  question: { prompt: "Qual é o seu e-mail?", variable: "email", validation: { type: "email" }, invalidMessage: "E-mail inválido, tente novamente." },
  condition: { attr: "name", op: "exists" },
  action: { actionType: "update_attribute", attr: "", value: "" },
  handoff: { queueId: "" },
};

export default function FlowCanvas() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: flow } = useQuery({ queryKey: ["flow", id], queryFn: () => flowsApi.get(id!), enabled: !!id });

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeCardData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [startNodeId, setStartNodeId] = useState<string>("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState("");

  useEffect(() => {
    if (!flow) return;
    const graph = flow.draft;
    setStartNodeId(graph.startNodeId);
    setKeywords(flow.keywords.join(", "));

    const loadedNodes: Node<FlowNodeCardData>[] = graph.nodes.map((n, idx) => ({
      id: n.id,
      type: "flowNode",
      position: n.position ?? { x: 80 + (idx % 3) * 260, y: 80 + Math.floor(idx / 3) * 160 },
      data: { nodeType: n.type, nodeData: n.data, isStart: n.id === graph.startNodeId },
    }));

    const loadedEdges: Edge[] = [];
    for (const n of graph.nodes) {
      n.next.forEach((targetId, idx) => {
        if (!targetId) return;
        loadedEdges.push({
          id: `${n.id}-${idx}-${targetId}`,
          source: n.id,
          target: targetId,
          sourceHandle: n.type === "condition" ? (idx === 0 ? "true" : "false") : undefined,
        });
      });
    }

    setNodes(loadedNodes);
    setEdges(loadedEdges);
  }, [flow?.id]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        const filtered = eds.filter((e) => !(e.source === connection.source && e.sourceHandle === connection.sourceHandle));
        return addEdge(connection, filtered);
      });
    },
    [setEdges]
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  function addNode(type: FlowNodeCardData["nodeType"]) {
    const id = newNodeId();
    const node: Node<FlowNodeCardData> = {
      id,
      type: "flowNode",
      position: { x: 80 + (nodes.length % 3) * 300, y: 80 + Math.floor(nodes.length / 3) * 220 },
      data: { nodeType: type, nodeData: { ...DEFAULT_DATA[type] } },
    };
    setNodes((nds) => [...nds, node]);
    if (!startNodeId) setStartNodeId(id);
  }

  function updateSelectedNodeData(patch: Partial<FlowNodeData>) {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, nodeData: { ...n.data.nodeData, ...patch } } } : n))
    );
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }

  const nodesWithStartFlag = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, isStart: n.id === startNodeId } })),
    [nodes, startNodeId]
  );

  function buildGraph() {
    const graphNodes: FlowGraphNode[] = nodes.map((n) => {
      const outgoing = edges.filter((e) => e.source === n.id);
      let next: string[];
      if (n.data.nodeType === "condition") {
        const trueEdge = outgoing.find((e) => e.sourceHandle === "true");
        const falseEdge = outgoing.find((e) => e.sourceHandle === "false");
        next = [trueEdge?.target ?? "", falseEdge?.target ?? ""];
      } else {
        next = outgoing[0]?.target ? [outgoing[0].target] : [];
      }
      return { id: n.id, type: n.data.nodeType, data: n.data.nodeData, next, position: n.position };
    });
    return { startNodeId, nodes: graphNodes };
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      flowsApi.update(id!, {
        draft: buildGraph(),
        keywords: keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow", id] }),
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      await saveMutation.mutateAsync();
      return flowsApi.publish(id!);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["flow", id] }),
  });

  if (!flow) return <div className="p-8 text-slate-500">Carregando…</div>;

  return (
    <div className="flex h-full min-h-[720px] flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
        <div>
          <Link to="/flows" className="text-xs text-brand-600 hover:underline">
            ← Voltar
          </Link>
          <h1 className="text-lg font-semibold text-slate-800">{flow.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            placeholder="palavras-chave (vírgula)"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
          <button onClick={() => saveMutation.mutate()} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Salvar rascunho
          </button>
          <button onClick={() => publishMutation.mutate()} className="rounded-md bg-brand-600 px-3 py-1.5 text-sm text-white hover:bg-brand-700">
            Publicar
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-40 space-y-2 border-r border-slate-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase text-slate-400">Paleta</p>
          {(["message", "question", "condition", "action", "handoff"] as const).map((t) => (
            <button
              key={t}
              onClick={() => addNode(t)}
              className="block w-full rounded-md border border-slate-200 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
            >
              + {t}
            </button>
          ))}
        </div>

        <div className="flex-1">
          <ReactFlow
            nodes={nodesWithStartFlag}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <div className="w-80 overflow-y-auto border-l border-slate-200 bg-white p-4">
          {!selectedNode && <p className="text-sm text-slate-400">Selecione um nó para editar.</p>}
          {selectedNode && (
            <NodeEditor
              node={selectedNode}
              onChange={updateSelectedNodeData}
              onDelete={deleteSelectedNode}
              onMarkStart={() => setStartNodeId(selectedNode.id)}
              isStart={selectedNode.id === startNodeId}
            />
          )}
        </div>
      </div>

      <FlowSimulatorBar channelId={flow.channelId} />
    </div>
  );
}

function NodeEditor({
  node,
  onChange,
  onDelete,
  onMarkStart,
  isStart,
}: {
  node: Node<FlowNodeCardData>;
  onChange: (patch: Partial<FlowNodeData>) => void;
  onDelete: () => void;
  onMarkStart: () => void;
  isStart: boolean;
}) {
  const { nodeType, nodeData } = node.data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">Editar: {nodeType}</span>
        <button onClick={onDelete} className="text-xs text-red-600 hover:underline">
          excluir
        </button>
      </div>
      {!isStart && (
        <button onClick={onMarkStart} className="text-xs text-brand-600 hover:underline">
          Marcar como nó inicial
        </button>
      )}

      {nodeType === "message" && (
        <textarea
          className="h-28 w-full rounded-md border border-slate-300 p-2 text-sm"
          placeholder="Texto da mensagem, use {{var}}"
          value={nodeData.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      )}

      {nodeType === "question" && (
        <div className="space-y-2">
          <textarea
            className="h-20 w-full rounded-md border border-slate-300 p-2 text-sm"
            placeholder="Pergunta"
            value={nodeData.prompt ?? ""}
            onChange={(e) => onChange({ prompt: e.target.value })}
          />
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="Nome da variável"
            value={nodeData.variable ?? ""}
            onChange={(e) => onChange({ variable: e.target.value })}
          />
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={nodeData.validation?.type ?? ""}
            onChange={(e) => onChange({ validation: e.target.value ? { type: e.target.value as any } : undefined })}
          >
            <option value="">Sem validação</option>
            <option value="email">E-mail</option>
            <option value="number">Número</option>
            <option value="date">Data</option>
            <option value="regex">Regex</option>
          </select>
          {nodeData.validation?.type === "regex" && (
            <input
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
              placeholder="Padrão regex"
              value={nodeData.validation.pattern ?? ""}
              onChange={(e) => onChange({ validation: { type: "regex", pattern: e.target.value } })}
            />
          )}
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="Mensagem se inválido"
            value={nodeData.invalidMessage ?? ""}
            onChange={(e) => onChange({ invalidMessage: e.target.value })}
          />
        </div>
      )}

      {nodeType === "condition" && (
        <div className="space-y-2">
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="Atributo ou variável"
            value={nodeData.attr ?? ""}
            onChange={(e) => onChange({ attr: e.target.value })}
          />
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={nodeData.op ?? "eq"}
            onChange={(e) => onChange({ op: e.target.value })}
          >
            {["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists", "not_exists"].map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            placeholder="Valor de comparação"
            value={nodeData.value ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
          />
        </div>
      )}

      {nodeType === "action" && (
        <div className="space-y-2">
          <select
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
            value={nodeData.actionType ?? "update_attribute"}
            onChange={(e) => onChange({ actionType: e.target.value as any })}
          >
            <option value="update_attribute">Atualizar atributo</option>
            <option value="add_tag">Adicionar tag</option>
            <option value="add_to_list">Adicionar à lista</option>
            <option value="webhook">Chamar webhook</option>
          </select>
          {nodeData.actionType === "update_attribute" && (
            <>
              <input className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="Nome do atributo" value={nodeData.attr ?? ""} onChange={(e) => onChange({ attr: e.target.value })} />
              <input className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="Valor (use {{var}})" value={nodeData.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} />
            </>
          )}
          {nodeData.actionType === "add_tag" && (
            <input className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="Tag" value={nodeData.tag ?? ""} onChange={(e) => onChange({ tag: e.target.value })} />
          )}
          {nodeData.actionType === "add_to_list" && (
            <input className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="ID da lista" value={nodeData.listId ?? ""} onChange={(e) => onChange({ listId: e.target.value })} />
          )}
          {nodeData.actionType === "webhook" && (
            <input className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm" placeholder="URL do webhook" value={nodeData.url ?? ""} onChange={(e) => onChange({ url: e.target.value })} />
          )}
        </div>
      )}

      {nodeType === "handoff" && (
        <input
          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
          placeholder="ID da fila"
          value={nodeData.queueId ?? ""}
          onChange={(e) => onChange({ queueId: e.target.value })}
        />
      )}
    </div>
  );
}

function FlowSimulatorBar({ channelId }: { channelId: string }) {
  const { data: contacts } = useQuery({ queryKey: ["contacts", ""], queryFn: () => contactsApi.list() });
  const [contactId, setContactId] = useState("");
  const [text, setText] = useState("");
  const [log, setLog] = useState<{ from: "eu" | "bot"; text: string }[]>([]);

  const sendMutation = useMutation({
    mutationFn: simulatorApi.sendInbound,
    onSuccess: async () => {
      setLog((l) => [...l, { from: "eu", text }]);
      setText("");
      if (contactId) {
        const contact = await contactsApi.get(contactId);
        const lastOut = contact.timeline?.filter((m: any) => m.direction === "OUT").slice(0, 3) ?? [];
        setLog((l) => [...l, ...lastOut.reverse().map((m: any) => ({ from: "bot" as const, text: JSON.parse(m.body)?.text }))]);
      }
    },
  });

  return (
    <div className="flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2">
      <span className="text-xs font-semibold text-slate-500">Testar fluxo:</span>
      <select className="rounded-md border border-slate-300 px-2 py-1 text-xs" value={contactId} onChange={(e) => setContactId(e.target.value)}>
        <option value="">Contato…</option>
        {contacts?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input
        className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
        placeholder="Digite como o cliente e pressione enviar"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={() => contactId && text && sendMutation.mutate({ contactId, channelId, text })}
        className="rounded-md bg-brand-600 px-3 py-1 text-xs text-white hover:bg-brand-700"
      >
        Enviar
      </button>
      <div className="max-w-xs truncate text-xs text-slate-400">{log.length > 0 && `Última resposta: ${log[log.length - 1]?.text}`}</div>
    </div>
  );
}
