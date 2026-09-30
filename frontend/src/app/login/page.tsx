'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(username, password);
      // La redirección está manejada en el context (hacia /)
    } catch {
      // Configuramos el mensaje de error y causamos la animación de shake
      setError('Usuario o contraseña incorrectos');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex h-[100dvh] w-screen items-center justify-center overflow-hidden overscroll-none bg-black font-sans">
      {/* Fondo sólido simple de alta estabilidad */}
      <div className="absolute inset-0 bg-black"></div>

      {/* Tarjeta Simple */}
      <div className="relative z-10 mx-4 w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <div className="mb-8 text-center">
          <h1 className="mb-2 bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
            QuestFest
          </h1>
          <p className="mx-auto max-w-xs text-xs text-gray-400 sm:text-sm">
            Misiones reales en fiestas reales
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/50 p-4 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 
            Vinculamos de forma explícita las etiquetas con los inputs mediante htmlFor/id y definimos 
            name y autoComplete para cumplir los estándares de accesibilidad a11y (WCAG) y permitir 
            que los gestores de contraseñas (Google, Apple Keychain, Bitwarden) rellenen credenciales con un solo toque en PWA.
          */}
          <div>
            <label
              htmlFor="login-username"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Usuario
            </label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white placeholder-gray-500 transition-all duration-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 focus:outline-none"
              placeholder="Nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Contraseña
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white placeholder-gray-500 transition-all duration-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-press w-full transform rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3.5 font-bold text-white shadow-lg transition-all duration-300 active:scale-[0.98] active:from-violet-500 active:to-indigo-500 lg:hover:scale-[1.02] lg:hover:from-violet-500 lg:hover:to-indigo-500 ${isSubmitting ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {isSubmitting ? 'Iniciando sesión...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-8 border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-gray-400">
            ¿No tienes cuenta aún?{' '}
            <Link
              href="/register"
              className="font-medium text-amber-400 transition-colors hover:text-amber-300"
            >
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
