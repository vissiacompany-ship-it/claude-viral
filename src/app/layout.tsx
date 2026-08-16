import type { Metadata } from 'next'
import './globals.css'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'Claude Viral',
  description: 'Sistema de criação de carrosséis virais para Instagram',
}

// Aplica o tema salvo ANTES do primeiro paint, senão a tela pisca escura->clara
// (ou o contrário) toda vez que a pessoa recarrega com o modo claro escolhido.
const themeInitScript = `
(function() {
  try {
    var t = localStorage.getItem('claude-viral-theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full">
        <ThemeToggle/>
        {children}
      </body>
    </html>
  )
}
