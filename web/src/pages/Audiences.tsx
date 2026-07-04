import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listsApi } from "../api/lists";
import { segmentsApi, SegmentCondition } from "../api/segments";
import { contactsApi } from "../api/contacts";

const OPS: SegmentCondition["op"][] = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists", "not_exists"];

export default function Audiences() {
  const [tab, setTab] = useState<"lists" | "segments" | "import">("lists");

  return (
    <div className="p-8">
      <h1 className="text-xl font-semibold text-slate-800">Audiências</h1>
      <div className="mt-4 flex gap-2 border-b border-slate-200">
        {(["lists", "segments", "import"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-brand-600 text-brand-700" : "text-slate-500"}`}
          >
            {t === "lists" ? "Listas" : t === "segments" ? "Segmentos" : "Importar CSV"}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "lists" && <ListsPanel />}
        {tab === "segments" && <SegmentsPanel />}
        {tab === "import" && <ImportPanel />}
      </div>
    </div>
  );
}

function ListsPanel() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const { data: lists } = useQuery({ queryKey: ["lists"], queryFn: listsApi.list });
  const createMutation = useMutation({
    mutationFn: listsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lists"] });
      setName("");
    },
  });

  return (
    <div>
      <form
        className="flex gap-2"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          createMutation.mutate(name);
        }}
      >
        <input
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nome da lista"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Criar lista</button>
      </form>

      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {lists?.map((l) => (
          <li key={l.id} className="flex justify-between px-4 py-2 text-sm">
            <span>{l.name}</span>
            <span className="text-slate-400">{l._count.members} contatos</span>
          </li>
        ))}
        {lists?.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">Nenhuma lista criada.</li>}
      </ul>
    </div>
  );
}

function SegmentsPanel() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<SegmentCondition[]>([{ attr: "name", op: "contains", value: "" }]);
  const { data: segments } = useQuery({ queryKey: ["segments"], queryFn: segmentsApi.list });
  const { data: attrDefs } = useQuery({ queryKey: ["attributeDefs"], queryFn: contactsApi.listAttributeDefs });

  const createMutation = useMutation({
    mutationFn: segmentsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      setName("");
    },
  });

  function updateCondition(idx: number, patch: Partial<SegmentCondition>) {
    setConditions((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  }

  return (
    <div>
      <form
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          createMutation.mutate({ name, filter: { logic: "AND", conditions } });
        }}
      >
        <input
          className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Nome do segmento"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div className="space-y-2">
          {conditions.map((c, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={c.attr}
                onChange={(e) => updateCondition(idx, { attr: e.target.value })}
              >
                <option value="name">nome</option>
                <option value="phone">telefone</option>
                <option value="email">email</option>
                {attrDefs?.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                value={c.op}
                onChange={(e) => updateCondition(idx, { op: e.target.value as SegmentCondition["op"] })}
              >
                {OPS.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
              {c.op !== "exists" && c.op !== "not_exists" && (
                <input
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  placeholder="valor"
                  value={c.value ?? ""}
                  onChange={(e) => updateCondition(idx, { value: e.target.value })}
                />
              )}
              <button
                type="button"
                onClick={() => setConditions((prev) => prev.filter((_, i) => i !== idx))}
                className="text-xs text-red-600 hover:underline"
              >
                remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setConditions((prev) => [...prev, { attr: "name", op: "contains", value: "" }])}
            className="text-xs text-brand-600 hover:underline"
          >
            + adicionar condição (E)
          </button>
        </div>
        <button className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Criar segmento
        </button>
      </form>

      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {segments?.map((s) => (
          <li key={s.id} className="px-4 py-2 text-sm">
            {s.name}
          </li>
        ))}
        {segments?.length === 0 && <li className="px-4 py-4 text-sm text-slate-400">Nenhum segmento criado.</li>}
      </ul>
    </div>
  );
}

function ImportPanel() {
  const [csv, setCsv] = useState("nome,telefone,email\n");
  const [nameCol, setNameCol] = useState("nome");
  const [phoneCol, setPhoneCol] = useState("telefone");
  const [emailCol, setEmailCol] = useState("email");
  const [report, setReport] = useState<any>(null);

  const importMutation = useMutation({
    mutationFn: contactsApi.importCsv,
    onSuccess: (data) => setReport(data),
  });

  return (
    <div className="space-y-3">
      <textarea
        className="h-40 w-full rounded-md border border-slate-300 p-2 font-mono text-xs"
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <input className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={nameCol} onChange={(e) => setNameCol(e.target.value)} placeholder="coluna do nome" />
        <input className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={phoneCol} onChange={(e) => setPhoneCol(e.target.value)} placeholder="coluna do telefone" />
        <input className="rounded-md border border-slate-300 px-2 py-1 text-sm" value={emailCol} onChange={(e) => setEmailCol(e.target.value)} placeholder="coluna do e-mail" />
      </div>
      <button
        onClick={() =>
          importMutation.mutate({ csv, mapping: { name: nameCol, phone: phoneCol || undefined, email: emailCol || undefined } })
        }
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        Importar
      </button>

      {report && (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm">
          <p>Total de linhas: {report.totalRows}</p>
          <p>Importados: {report.importedCount}</p>
          <p>Duplicados: {report.duplicateCount}</p>
          <p>Erros: {report.errorCount}</p>
          <ul className="mt-1 list-disc pl-4 text-red-600">
            {report.errors.map((e: any, i: number) => (
              <li key={i}>
                Linha {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
