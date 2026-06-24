import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Sidebar } from '@/components/Sidebar'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'NewsHub — Lo último, al instante',
  description: 'Agregador de noticias personalizado con alertas en tiempo real.',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: '#0f0f0f',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes de pintar (evita parpadeo). Oscuro por defecto. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: script de tema inline
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('newshub.theme');document.documentElement.classList.toggle('dark', t? t==='dark' : true);}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <Sidebar />
          <main className="ml-20 min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
