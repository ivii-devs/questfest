import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Habilitamos la salida 'standalone' para que Next.js trace y empaquete de manera autónoma
  // únicamente las dependencias de producción necesarias en '.next/standalone', reduciendo el tamaño
  // de la imagen Docker final de ~1GB a menos de 150MB y optimizando el consumo de memoria en el servidor.
  output: 'standalone',
  reactCompiler: true,
  allowedDevOrigins: ['192.168.1.101', 'localhost', '127.0.0.1'],
};

export default nextConfig;