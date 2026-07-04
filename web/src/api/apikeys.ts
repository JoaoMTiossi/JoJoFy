import { api } from "./client";

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  revoked: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

export const apiKeysApi = {
  list: () => api.get<ApiKeyItem[]>("/api-keys").then((r) => r.data),
  create: (data: { name: string; scopes: string[] }) =>
    api.post<{ id: string; name: string; scopes: string[]; key: string; keyPrefix: string }>("/api-keys", data).then((r) => r.data),
  revoke: (id: string) => api.delete(`/api-keys/${id}`),
};
