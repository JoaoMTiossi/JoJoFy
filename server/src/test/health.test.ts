import { describe, it, expect } from "vitest";
import { createTestApp } from "./helpers.js";

describe("health", () => {
  it("returns ok", async () => {
    const app = await createTestApp();
    const response = await app.inject({ method: "GET", url: "/api/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});
