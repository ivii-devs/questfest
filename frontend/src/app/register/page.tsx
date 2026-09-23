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
      setError("Las contraseñas no coinciden");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setIsSubmitting(true);

    try {
      // Llamada al endpoint de registro (espera JSON en backend)
      await api.post('/api/auth/register', { username, password });
      
      // Si el registro es exitoso, logueamos automáticamente al usuario
      await login(username, password);
    } catch (error: any) {
      console.error("Detalle del fallo:", error.response?.data || error.message);
      // Manejamos el error específico del backend si el usuario ya existe (HTTP 400)
      if (error.response && error.response.status === 400) {
        setError(error.response.data.detail || "Error en el registro");
      } else {
        setError("Error de conexión. Inténtalo de nuevo.");
      }
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
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200 mb-2 tracking-tight">Nuevo Jugador</h1>
          <p className="text-gray-400 text-sm">Crea tu cuenta en QuestFest para unirte a la experiencia</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-300 text-sm text-center">
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
            <label htmlFor="register-username" className="block text-sm font-medium text-gray-300 mb-2">Usuario</label>
            <input
              id="register-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all duration-300"
              placeholder="Nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label htmlFor="register-password" className="block text-sm font-medium text-gray-300 mb-2">Contraseña</label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-300"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <div>
            <label htmlFor="register-confirm-password" className="block text-sm font-medium text-gray-300 mb-2">Confirmar Contraseña</label>
            <input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-xl text-base text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all duration-300"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 active:from-amber-400 active:to-amber-500 lg:hover:from-amber-400 lg:hover:to-amber-500 text-slate-900 font-bold rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.3)] transform active:scale-[0.98] lg:hover:scale-[1.02] transition-all duration-300 mt-2 btn-press ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSubmitting ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-white/10 pt-6">
          <p className="text-gray-400 text-sm">
            ¿Ya tienes tu cuenta?{' '}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium transition-colors">
              Inicia Sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
