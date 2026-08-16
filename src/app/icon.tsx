import { ImageResponse } from 'next/og'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

// Favicon do Claude Viral — mesmo asterisco/sunburst de 8 pontas em degradê âmbar usado
// na barra lateral (ver src/components/LogoMark.tsx), sem caixa de fundo atrás.
const RAY = 'M50,6 C47,22 44,34 44,50 C44,66 47,78 50,94 C53,78 56,66 56,50 C56,34 53,22 50,6 Z'

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="30" height="30" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#FFC94A"/>
              <stop offset="1" stopColor="#FF6A1E"/>
            </linearGradient>
          </defs>
          {[0, 45, 90, 135].map(a => (
            <path key={a} d={RAY} fill="url(#g)" transform={`rotate(${a} 50 50)`}/>
          ))}
        </svg>
      </div>
    ),
    { ...size }
  )
}
