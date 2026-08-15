// Abre um Chromium pra tirar print dos slides (export em PNG e thumbnail do dashboard).
// Tenta primeiro o Chromium embutido do Playwright (portátil — funciona igual em qualquer
// computador depois de "npx playwright install chromium"). Se não tiver instalado, cai pro
// Google Chrome do sistema como alternativa.
export async function launchBrowser(): Promise<unknown> {
  const pw = require('playwright') as { chromium: { launch: (o?: Record<string, unknown>) => Promise<unknown> } } // eslint-disable-line @typescript-eslint/no-require-imports
  try {
    return await pw.chromium.launch()
  } catch {
    return await pw.chromium.launch({ channel: 'chrome' })
  }
}
