import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilitamos la salida 'standalone' para que Next.js trace y empaquete de manera autónoma
  // únicamente las dependencias de producción necesarias en '.next/standalone', reduciendo el tamaño
  // de la imagen Docker final de ~1GB a menos de 150MB y optimizando el consumo de memoria en el servidor.
  output: 'standalone',
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.101', 'localhost', '127.0.0.1'],
  // Reescrituras para desarrollo local: permite consumir la API de FastAPI de forma transparente
  // sin lidiar con bloqueos de CORS cuando el frontend corre en el puerto 3000 y el backend en el 8000.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NODE_ENV === 'development'
          ? 'http://127.0.0.1:8000/api/:path*'
          : '/api/:path*',
      },
    ];
  },
};

export default nextConfig;