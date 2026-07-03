import { Input } from "../ui/Input";
import { Textarea } from "../ui/Textarea";
import { Select } from "../ui/Select";
import type { Field } from "../../types";

interface FieldInputProps {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function toDateInputValue(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function FieldInput({ field, value, onChange, error }: FieldInputProps) {
  const options: string[] = field.options ? JSON.parse(field.options) : [];

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">
        {field.label}
        {field.required && <span className="text-red-500"> *</span>}
      </label>

      {field.type === "textarea" && (
        <Textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === "select" && (
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      )}

      {field.type === "number" && (
        <Input type="number" value={value} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === "date" && (
        <Input
          type="date"
          value={toDateInputValue(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.type === "email" && (
        <Input type="email" value={value} onChange={(e) => onChange(e.target.value)} />
      )}

      {field.type === "text" && (
        <Input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
