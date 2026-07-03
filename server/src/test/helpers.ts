import type { FastifyInstance } from "fastify";
import { buildApp } from "../app.js";

export async function createTestApp(): Promise<FastifyInstance> {
  return buildApp();
}

export async function registerAndLogin(
  app: FastifyInstance,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
) {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`;
  const payload = {
    name: overrides.name ?? "Test User",
    email,
    password: overrides.password ?? "password123",
  };
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload,
  });
  const body = response.json();
  return { token: body.token as string, user: body.user as { id: string; name: string; email: string } };
}

export async function createPipe(app: FastifyInstance, token: string, name = "Pipe de teste") {
  const response = await app.inject({
    method: "POST",
    url: "/api/pipes",
    headers: { authorization: `Bearer ${token}` },
    payload: { name },
  });
  return response.json().pipe;
}
