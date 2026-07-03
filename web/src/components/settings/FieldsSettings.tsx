import { useState } from "react";
import type { FormEvent } from "react";
import {
  useCreateField,
  useDeleteField,
  useUpdateField,
} from "../../api/queries";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { ApiError } from "../../api/client";
import type { Pipe } from "../../types";

const TYPE_LABELS: Record<string, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  date: "Data",
  select: "Seleção única",
  email: "E-mail",
};

export function FieldsSettings({ pipe }: { pipe: Pipe }) {
  const createField = useCreateField(pipe.id);
  const updateField = useUpdateField(pipe.id);
  const deleteField = useDeleteField(pipe.id);

  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await createField.mutateAsync({
        label,
        type,
        required,
        options:
          type === "select"
            ? optionsText
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      });
      setLabel("");
      setType("text");
      setRequired(false);
      setOptionsText("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao criar campo");
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 text-base font-semibold text-slate-800">Campos do formulário</h2>

      <ul className="mb-6 flex flex-col gap-2">
        {pipe.fields.map((field) => (
          <li
            key={field.id}
            className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-4 py-2"
          >
            <div>
              <p className="text-sm font-medium text-slate-800">
                {field.label}{" "}
                {field.required && <span className="text-xs text-red-500">obrigatório</span>}
              </p>
              <p className="text-xs text-slate-500">{TYPE_LABELS[field.type] ?? field.type}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={(e) =>
                    updateField.mutate({ fieldId: field.id, data: { required: e.target.checked } })
                  }
                />
                obrigatório
              </label>
              <Button
                variant="ghost"
                onClick={() => deleteField.mutate(field.id)}
                className="text-red-600"
              >
                Excluir
              </Button>
            </div>
          </li>
        ))}
        {pipe.fields.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum campo cadastrado ainda.</p>
        )}
      </ul>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4"
      >
        <h3 className="text-sm font-semibold text-slate-700">Adicionar campo</h3>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Input
            placeholder="Rótulo do campo"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            required
          />
          <Select value={type} onChange={(e) => setType(e.target.value)} className="max-w-[180px]">
            {Object.entries(TYPE_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Select>
        </div>
        {type === "select" && (
          <Input
            placeholder="Opções separadas por vírgula (ex.: Baixa, Média, Alta)"
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
          />
        )}
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          Campo obrigatório
        </label>
        <Button type="submit" disabled={createField.isPending} className="self-start">
          Adicionar
        </Button>
      </form>
    </div>
  );
}
