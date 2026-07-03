export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Label {
  id: string;
  pipeId: string;
  name: string;
  color: string;
}

export interface Field {
  id: string;
  pipeId: string;
  label: string;
  type: "text" | "textarea" | "number" | "date" | "select" | "email";
  required: boolean;
  options: string | null;
  position: number;
}

export interface FieldValue {
  id: string;
  cardId: string;
  fieldId: string;
  value: string;
}

export interface CardAssignee {
  cardId: string;
  userId: string;
  user: User;
}

export interface CardLabel {
  cardId: string;
  labelId: string;
  label: Label;
}

export interface Comment {
  id: string;
  cardId: string;
  authorId: string;
  author: User;
  body: string;
  createdAt: string;
}

export interface Activity {
  id: string;
  cardId: string;
  actorName: string;
  type: string;
  detail: string;
  createdAt: string;
}

export interface Card {
  id: string;
  phaseId: string;
  title: string;
  position: number;
  dueDate: string | null;
  createdAt: string;
  values: FieldValue[];
  assignees: CardAssignee[];
  labels: CardLabel[];
  comments?: Comment[];
  activities?: Activity[];
}

export interface Phase {
  id: string;
  pipeId: string;
  name: string;
  position: number;
  isDone: boolean;
  isCanceled: boolean;
  cards: Card[];
}

export interface Pipe {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  phases: Phase[];
  fields: Field[];
  labels: Label[];
}

export interface PipeSummary {
  id: string;
  name: string;
  icon: string;
  color: string;
  createdAt: string;
  activeCardsCount: number;
  totalCardsCount: number;
}
