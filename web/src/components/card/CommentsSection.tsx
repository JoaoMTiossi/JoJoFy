import { useState } from "react";
import type { FormEvent } from "react";
import type { Comment } from "../../types";
import { Textarea } from "../ui/Textarea";
import { Button } from "../ui/Button";
import { Avatar } from "../ui/Avatar";

function formatDate(date: string): string {
  return new Date(date).toLocaleString("pt-BR");
}

export function CommentsSection({
  comments,
  onSubmit,
  isSubmitting,
}: {
  comments: Comment[];
  onSubmit: (body: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [body, setBody] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await onSubmit(body);
    setBody("");
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-2">
            <Avatar name={comment.author.name} size={24} />
            <div className="min-w-0 flex-1 rounded-md bg-slate-50 px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-slate-800">{comment.author.name}</span>
                <span className="text-xs text-slate-400">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{comment.body}</p>
            </div>
          </li>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-slate-400">Nenhum comentário ainda.</p>
        )}
      </ul>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          placeholder="Escreva um comentário..."
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button type="submit" disabled={isSubmitting || !body.trim()} className="self-end">
          Comentar
        </Button>
      </form>
    </div>
  );
}
