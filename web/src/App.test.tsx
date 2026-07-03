import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirects unauthenticated users to the login page", async () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText("Entre na sua conta")).toBeInTheDocument();
  });
});
