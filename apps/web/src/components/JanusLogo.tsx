// Logo de Jano (Janus): dos perfiles sólidos en espejo, mirando en direcciones
// opuestas (pasado/futuro = doble perspectiva, neutralidad). Nariz triangular marcada
// y hueco central como "eje de neutralidad"; legible incluso pequeño. Degradado dorado
// + aro de moneda romana.
export function JanusLogo({ className }: { className?: string }) {
  // Perfil derecho; el izquierdo es su espejo. Borde interior en x≈210 → el canal
  // central deja ver el fondo y separa las dos caras.
  const face =
    'M 210 80 C 238 80 253 97 254 124 C 255 141 250 152 246 162 L 288 190 L 248 202 ' +
    'C 257 212 257 224 247 234 C 259 246 257 264 244 278 C 236 302 230 318 222 336 L 210 336 Z'

  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="janusGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3da86" />
          <stop offset="0.5" stopColor="#d8ab4c" />
          <stop offset="1" stopColor="#a9772f" />
        </linearGradient>
      </defs>

      {/* Aro de moneda */}
      <circle cx="200" cy="200" r="188" fill="none" stroke="url(#janusGold)" strokeWidth="12" strokeOpacity="0.6" />

      {/* Cara derecha + cara izquierda (espejo) */}
      <g fill="url(#janusGold)">
        <path d={face} />
        <path d={face} transform="translate(400,0) scale(-1,1)" />
      </g>

      {/* Ojos (huecos) */}
      <circle cx="247" cy="152" r="10" fill="#0d0d0d" />
      <circle cx="153" cy="152" r="10" fill="#0d0d0d" />
    </svg>
  )
}
