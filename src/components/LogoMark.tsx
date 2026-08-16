// Marca do Claude Viral — asterisco/sunburst de 8 pontas, no estilo da marca do Claude,
// preenchido com o degradê âmbar da identidade, sem caixa de fundo atrás.
// Usado no cabeçalho da barra lateral e como base do favicon (app/icon.tsx).
const RAY = 'M50,6 C47,22 44,34 44,50 C44,66 47,78 50,94 C53,78 56,66 56,50 C56,34 53,22 50,6 Z'

export default function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cv-logo-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFC94A"/>
          <stop offset="1" stopColor="#FF6A1E"/>
        </linearGradient>
      </defs>
      {[0, 45, 90, 135].map(a => (
        <path key={a} d={RAY} fill="url(#cv-logo-grad)" transform={`rotate(${a} 50 50)`}/>
      ))}
    </svg>
  )
}
