import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "./client";
import type { Card, Field, Label, Phase, Pipe, PipeSummary, User } from "../types";

export function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<{ users: User[] }>("/users").then((r) => r.users),
  });
}

export function usePipes() {
  return useQuery({
    queryKey: ["pipes"],
    queryFn: () => apiFetch<{ pipes: PipeSummary[] }>("/pipes").then((r) => r.pipes),
  });
}

export function usePipe(id: string | undefined) {
  return useQuery({
    queryKey: ["pipe", id],
    queryFn: () => apiFetch<{ pipe: Pipe }>(`/pipes/${id}`).then((r) => r.pipe),
    enabled: !!id,
  });
}

export function useCard(id: string | undefined) {
  return useQuery({
    queryKey: ["card", id],
    queryFn: () => apiFetch<{ card: Card }>(`/cards/${id}`).then((r) => r.card),
    enabled: !!id,
  });
}

export function useCreatePipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; icon?: string; color?: string }) =>
      apiFetch<{ pipe: Pipe }>("/pipes", { method: "POST", body: JSON.stringify(data) }).then(
        (r) => r.pipe
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipes"] }),
  });
}

export function useUpdatePipe(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<{ name: string; icon: string; color: string }>) =>
      apiFetch<{ pipe: Pipe }>(`/pipes/${pipeId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.pipe),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipes"] });
      qc.invalidateQueries({ queryKey: ["pipe", pipeId] });
    },
  });
}

export function useDeletePipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pipeId: string) => apiFetch<void>(`/pipes/${pipeId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipes"] }),
  });
}

export function useCreateCard(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; values?: Record<string, unknown>; dueDate?: string | null }) =>
      apiFetch<{ card: Card }>(`/pipes/${pipeId}/cards`, {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.card),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useUpdateCard(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      data,
    }: {
      cardId: string;
      data: { title?: string; dueDate?: string | null; values?: Record<string, unknown> };
    }) =>
      apiFetch<{ card: Card }>(`/cards/${cardId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.card),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ["pipe", pipeId] });
      qc.invalidateQueries({ queryKey: ["card", card.id] });
    },
  });
}

export function useDeleteCard(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => apiFetch<void>(`/cards/${cardId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useMoveCard(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cardId,
      phaseId,
      position,
    }: {
      cardId: string;
      phaseId: string;
      position: number;
    }) =>
      apiFetch<{ card: Card }>(`/cards/${cardId}/move`, {
        method: "POST",
        body: JSON.stringify({ phaseId, position }),
      }).then((r) => r.card),
    onSettled: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useAssignUser(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, userId }: { cardId: string; userId: string }) =>
      apiFetch<{ card: Card }>(`/cards/${cardId}/assignees`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }).then((r) => r.card),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ["pipe", pipeId] });
      qc.invalidateQueries({ queryKey: ["card", card.id] });
    },
  });
}

export function useUnassignUser(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, userId }: { cardId: string; userId: string }) =>
      apiFetch<{ card: Card }>(`/cards/${cardId}/assignees/${userId}`, { method: "DELETE" }).then(
        (r) => r.card
      ),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ["pipe", pipeId] });
      qc.invalidateQueries({ queryKey: ["card", card.id] });
    },
  });
}

export function useAddCardLabel(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, labelId }: { cardId: string; labelId: string }) =>
      apiFetch<{ card: Card }>(`/cards/${cardId}/labels`, {
        method: "POST",
        body: JSON.stringify({ labelId }),
      }).then((r) => r.card),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ["pipe", pipeId] });
      qc.invalidateQueries({ queryKey: ["card", card.id] });
    },
  });
}

export function useRemoveCardLabel(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, labelId }: { cardId: string; labelId: string }) =>
      apiFetch<{ card: Card }>(`/cards/${cardId}/labels/${labelId}`, {
        method: "DELETE",
      }).then((r) => r.card),
    onSuccess: (card) => {
      qc.invalidateQueries({ queryKey: ["pipe", pipeId] });
      qc.invalidateQueries({ queryKey: ["card", card.id] });
    },
  });
}

export function useAddComment(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, body }: { cardId: string; body: string }) =>
      apiFetch(`/cards/${cardId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["card", variables.cardId] });
      qc.invalidateQueries({ queryKey: ["pipe", pipeId] });
    },
  });
}

export function useCreatePhase(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; isDone?: boolean; isCanceled?: boolean }) =>
      apiFetch<{ phase: Phase }>(`/pipes/${pipeId}/phases`, {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.phase),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useUpdatePhase(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      phaseId,
      data,
    }: {
      phaseId: string;
      data: Partial<{ name: string; isDone: boolean; isCanceled: boolean }>;
    }) =>
      apiFetch<{ phase: Phase }>(`/phases/${phaseId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.phase),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useReorderPhases(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phaseIds: string[]) =>
      apiFetch(`/pipes/${pipeId}/phases/reorder`, {
        method: "PATCH",
        body: JSON.stringify({ phaseIds }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useDeletePhase(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phaseId: string) => apiFetch<void>(`/phases/${phaseId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useCreateField(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      label: string;
      type: string;
      required?: boolean;
      options?: string[];
    }) =>
      apiFetch<{ field: Field }>(`/pipes/${pipeId}/fields`, {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.field),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useUpdateField(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      fieldId,
      data,
    }: {
      fieldId: string;
      data: Partial<{ label: string; type: string; required: boolean; options: string[] }>;
    }) =>
      apiFetch<{ field: Field }>(`/fields/${fieldId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.field),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useDeleteField(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fieldId: string) => apiFetch<void>(`/fields/${fieldId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useCreateLabel(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      apiFetch<{ label: Label }>(`/pipes/${pipeId}/labels`, {
        method: "POST",
        body: JSON.stringify(data),
      }).then((r) => r.label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useUpdateLabel(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      labelId,
      data,
    }: {
      labelId: string;
      data: Partial<{ name: string; color: string }>;
    }) =>
      apiFetch<{ label: Label }>(`/labels/${labelId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }).then((r) => r.label),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}

export function useDeleteLabel(pipeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labelId: string) => apiFetch<void>(`/labels/${labelId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipe", pipeId] }),
  });
}
