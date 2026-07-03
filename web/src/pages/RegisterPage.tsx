import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { ApiError } from "../api/client";

export default function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg bg-white p-8 shadow-md"
      >
        <h1 className="mb-1 text-2xl font-bold text-slate-900">JoJoFy</h1>
        <p className="mb-6 text-sm text-slate-500">Crie sua conta</p>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <label className="mb-1 block text-sm font-medium text-slate-700">Nome</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required className="mb-4" />

        <label className="mb-1 block text-sm font-medium text-slate-700">E-mail</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mb-4"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Senha</label>
        <Input
          type="password"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="mb-6"
        />

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Cadastrando..." : "Cadastrar"}
        </Button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-blue-600 hover:underline">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}
