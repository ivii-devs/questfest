'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import api from '@/lib/axios';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsSubmitting(true);

    try {
      // Llamada al endpoint de registro (espera JSON en backend)
      await api.post('/api/auth/register', { username, password });

      // Si el registro es exitoso, logueamos automáticamente al usuario
      await login(username, password);
    } catch (error: unknown) {
      const err = error as {
        response?: { status?: number; data?: { detail?: string } };
        message?: string;
      };
      console.error('Detalle del fallo:', err.response?.data || err.message);
      // Manejamos el error específico del backend si el usuario ya existe (HTTP 400)
      if (err.response && err.response.status === 400) {
        setError(err.response.data?.detail || 'Error en el registro');
      } else {
        setError('Error de conexión. Inténtalo de nuevo.');
      }
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
          <h1 className="mb-2 bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Nuevo Jugador
          </h1>
          <p className="text-sm text-gray-400">
            Crea tu cuenta en QuestFest para unirte a la experiencia
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/50 p-4 text-center text-sm text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 
            Vinculamos las etiquetas a sus inputs correspondientes e indicamos los metadatos de autocompletado
            (new-password / username) para que el navegador y los administradores de contraseñas puedan sugerir
            o generar contraseñas seguras automáticamente y los lectores de pantalla anuncien correctamente cada campo.
          */}
          <div>
            <label
              htmlFor="register-username"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Usuario
            </label>
            <input
              id="register-username"
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
              htmlFor="register-password"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Contraseña
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white placeholder-gray-500 transition-all duration-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:outline-none"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="register-confirm-password"
              className="mb-2 block text-sm font-medium text-gray-300"
            >
              Confirmar Contraseña
            </label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-base text-white placeholder-gray-500 transition-all duration-300 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/50 focus:outline-none"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`btn-press mt-2 w-full transform rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-3.5 font-bold text-slate-900 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all duration-300 active:scale-[0.98] active:from-amber-400 active:to-amber-500 lg:hover:scale-[1.02] lg:hover:from-amber-400 lg:hover:to-amber-500 ${isSubmitting ? 'cursor-not-allowed opacity-70' : ''}`}
          >
            {isSubmitting ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-6 text-center">
          <p className="text-sm text-gray-400">
            ¿Ya tienes tu cuenta?{' '}
            <Link
              href="/login"
              className="font-medium text-violet-400 transition-colors hover:text-violet-300"
            >
              Inicia Sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
