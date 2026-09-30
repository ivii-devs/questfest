import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // En Docker usamos 'standalone' para optimizar la imagen a ~150MB.
  // En Vercel (donde VERCEL=1 se define automáticamente), dejamos 'output' por defecto
  // para que Vercel genere su enrutamiento serverless nativo sin errores 404.
  output: process.env.VERCEL ? undefined : 'standalone',
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.101', 'localhost', '127.0.0.1'],
  // Reescrituras: únicamente en desarrollo local para redirigir peticiones relativas al puerto 8000 de FastAPI.
  // En producción devolvemos array vacío para evitar bucles circulares de reescritura.
  async rewrites() {
    if (process.env.NODE_ENV === 'development') {
      return [
        {
          source: '/api/:path*',
          destination: 'http://127.0.0.1:8000/api/:path*',
        },
      ];
    }
    return [];
  },
};

export default nextConfig;
