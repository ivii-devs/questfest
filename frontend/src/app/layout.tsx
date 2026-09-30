import type { Metadata, Viewport } from 'next';
import './globals.css';
import BottomNav from '@/components/BottomNav';
import { AuthProvider } from '@/context/AuthContext';
import { GroupProvider } from '@/context/GroupContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import GlobalNotificationListener from '@/components/GlobalNotificationListener';
import SWRegister from '@/components/SWRegister';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';

export const metadata: Metadata = {
  title: 'QuestFest',
  description:
    'Misiones reales en fiestas reales: la app interactiva y punto de encuentro para tus eventos',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
      {
        url: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'QuestFest',
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
         * SCRIPT SÍNCRONO ANTI-FOUC (Flash of Unstyled Content):
         * Ejecuta en el hilo principal antes de pintar el DOM. Lee las preferencias de localStorage
         * y resuelve el esquema de color del sistema si corresponde, inyectando inmediatamente
         * 'data-theme' y 'data-palette' en <html> para prevenir cualquier parpadeo de color.
         */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var m = localStorage.getItem('questfest-theme-mode') || 'dark';
                  var p = localStorage.getItem('questfest-theme-palette') || 'default';
                  var r = m;
                  if (m === 'system') {
                    r = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  document.documentElement.setAttribute('data-theme', r);
                  document.documentElement.setAttribute('data-palette', p);
                } catch(e) {}
              })();
            `,
          }}
        />
        {/* Enlaces explícitos de icono para Safari en iOS al añadir a la pantalla de inicio */}
        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="apple-touch-icon-precomposed"
          sizes="180x180"
          href="/apple-touch-icon-precomposed.png"
        />
      </head>
      {/* Contenedor del App Shell nativo: marco inamovible de 100dvh con fondo dinámico del tema */}
      <body
        className="text-dracula-light fixed inset-0 h-[100dvh] w-full overflow-hidden bg-[var(--theme-app-bg)] font-sans antialiased select-none"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <AuthProvider>
            <GroupProvider>
              <SWRegister />
              {children}
              <BottomNav />
              <GlobalNotificationListener />
              <PWAInstallPrompt />
              <Toaster
                position="top-center"
                containerStyle={{
                  top: 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.85rem))',
                }}
                toastOptions={{
                  className:
                    'font-bold text-sm bg-dracula-card text-dracula-light border border-dracula-gray/20 shadow-2xl',
                }}
              />
            </GroupProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
