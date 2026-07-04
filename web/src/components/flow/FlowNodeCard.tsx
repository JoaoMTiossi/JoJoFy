import { Handle, Position } from "@xyflow/react";
import { FlowNodeData } from "../../api/flows";

const TYPE_LABEL: Record<string, string> = {
  message: "Mensagem",
  question: "Pergunta",
  condition: "Condição",
  action: "Ação",
  handoff: "Transbordo",
};

const TYPE_COLOR: Record<string, string> = {
  message: "border-sky-300 bg-sky-50",
  question: "border-amber-300 bg-amber-50",
  condition: "border-purple-300 bg-purple-50",
  action: "border-emerald-300 bg-emerald-50",
  handoff: "border-rose-300 bg-rose-50",
};

export interface FlowNodeCardData extends Record<string, unknown> {
  nodeType: "message" | "question" | "condition" | "action" | "handoff";
  nodeData: FlowNodeData;
  isStart?: boolean;
}

export default function FlowNodeCard({ data }: { data: FlowNodeCardData }) {
  const { nodeType, nodeData, isStart } = data;
  const summary =
    nodeData.text || nodeData.prompt || (nodeType === "condition" ? `${nodeData.attr} ${nodeData.op} ${nodeData.value ?? ""}` : nodeType === "action" ? nodeData.actionType : nodeType === "handoff" ? `fila: ${nodeData.queueId ?? "?"}` : "");

  return (
    <div className={`w-56 rounded-lg border-2 p-3 text-xs shadow-sm ${TYPE_COLOR[nodeType]}`}>
      <Handle type="target" position={Position.Left} />
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">{TYPE_LABEL[nodeType]}</span>
        {isStart && <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[10px] text-white">início</span>}
      </div>
      <p className="mt-1 line-clamp-3 text-slate-600">{summary || "(sem conteúdo)"}</p>

      {nodeType === "condition" ? (
        <>
          <Handle type="source" position={Position.Right} id="true" style={{ top: "35%" }} />
          <Handle type="source" position={Position.Right} id="false" style={{ top: "65%" }} />
          <div className="mt-1 flex justify-between text-[10px] text-slate-400">
            <span>verdadeiro ↗</span>
            <span>falso ↘</span>
          </div>
        </>
      ) : nodeType === "handoff" ? null : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
