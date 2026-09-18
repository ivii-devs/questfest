import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Proxy perimetral de red para Next.js 16+.
 * Sustituye formalmente a la convención en desuso 'middleware.ts'.
 * Intercepta las solicitudes antes de que se rendericen en React,
 * protegiendo las rutas privadas y redirigiendo hacia la pantalla de autenticación
 * o al espacio de grupos según el estado de la sesión.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Archivos estáticos y recursos PWA:
   * Safari y otros navegadores solicitan iconos ('apple-touch-icon.png', 'icons/*'),
   * el manifiesto ('manifest.json') y el service worker ('sw.js') sin cookies de sesión.
   * Si el proxy los intercepta y redirige al login con HTTP 307, Safari no puede decodificar
   * la imagen y recurre al icono de contingencia por defecto (la letra 'Q').
   * Garantizamos que cualquier archivo estático fluya directamente hacia el servidor web.
   */
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/icons') ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/favicon.ico' ||
    pathname.includes('apple-touch-icon') ||
    /\.(?:png|jpg|jpeg|gif|webp|svg|ico|json|js|css|woff2?|map)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Obtenemos la cookie con el token JWT inyectada en el login
  const token = request.cookies.get('access_token')?.value;

  // Rutas de autenticación que siempre son públicas para usuarios no registrados
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');

  // Si el usuario no dispone de sesión activa e intenta acceder a rutas protegidas
  if (!token && !isAuthRoute) {
    // Redirigimos forzosamente al login, impidiendo que el cliente monte el árbol de componentes
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si el usuario ya cuenta con sesión iniciada pero visita /login o /register, o entra a la raíz /,
  // lo redirigimos forzosamente al Hub de Bienvenida (/groups) en el perímetro de red (0 ms de latencia)
  if (token && (isAuthRoute || pathname === '/')) {
    const groupsUrl = new URL('/groups', request.url);
    return NextResponse.redirect(groupsUrl);
  }

  // En cualquier otro caso, dejamos fluir la petición hacia el handler correspondiente
  return NextResponse.next();
}

/**
 * Filtro de rutas (Matcher): Define con precisión qué rutas son evaluadas por el proxy.
 * Se excluyen explícitamente recursos estáticos, imágenes optimizadas,
 * favicons, iconos PWA, manifest y endpoints internos de API para preservar el rendimiento.
 */
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons|apple-touch-icon.*|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|json|js|css|woff2?)$).*)',
  ],
};
