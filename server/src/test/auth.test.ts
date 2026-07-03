import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

describe("auth", () => {
  it("registers a new user and returns a token", async () => {
    const app = await createTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Alice", email: "alice@example.com", password: "password123" },
    });
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.token).toBeTypeOf("string");
    expect(body.user.email).toBe("alice@example.com");
    expect(body.user.passwordHash).toBeUndefined();
  });

  it("rejects duplicate email", async () => {
    const app = await createTestApp();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Alice", email: "dup@example.com", password: "password123" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Alice 2", email: "dup@example.com", password: "password123" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("logs in with correct credentials", async () => {
    const app = await createTestApp();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Bob", email: "bob@example.com", password: "password123" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bob@example.com", password: "password123" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().token).toBeTypeOf("string");
  });

  it("rejects wrong password with 401", async () => {
    const app = await createTestApp();
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Carol", email: "carol@example.com", password: "password123" },
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "carol@example.com", password: "wrongpassword" },
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns 401 for protected routes without a token", async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/api/me" });
    expect(response.statusCode).toBe(401);
  });

  it("returns current user with a valid token", async () => {
    const app = await createTestApp();
    const register = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Dave", email: "dave@example.com", password: "password123" },
    });
    const { token } = register.json();
    const response = await app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe("dave@example.com");
  });
});
