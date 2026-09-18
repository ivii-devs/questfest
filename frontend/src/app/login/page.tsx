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
      setError("Usuario o contraseña incorrectos");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden overscroll-none h-[100dvh] w-screen flex items-center justify-center bg-black font-sans">
      {/* Fondo sólido simple de alta estabilidad */}
      <div className="absolute inset-0 bg-black"></div>

      {/* Tarjeta Simple */}
      <div className="relative z-10 w-full max-w-md p-8 bg-slate-900 border border-slate-700 rounded-2xl shadow-xl mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500 mb-2 tracking-tight">QuestFest</h1>
          <p className="text-gray-400 text-xs sm:text-sm max-w-xs mx-auto">Misiones reales en fiestas reales</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm text-center">
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
            <label htmlFor="login-username" className="block text-sm font-medium text-gray-300 mb-2">Usuario</label>
            <input
              id="login-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all duration-300"
              placeholder="Tu nombre de jugador"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-300"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 active:from-violet-500 active:to-indigo-500 lg:hover:from-violet-500 lg:hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg transform active:scale-[0.98] lg:hover:scale-[1.02] transition-all duration-300 btn-press ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Autenticando...' : 'Entrar al Juego'}
          </button>
        </form>

        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <p className="text-gray-400 text-sm">
            ¿No tienes cuenta aún?{' '}
            <Link href="/register" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
