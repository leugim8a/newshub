// Logo de Jano (Janus): dos caras en direcciones opuestas = doble perspectiva /
// neutralidad. Usa currentColor para adaptarse al tema (dorado en la marca).
export function JanusLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Círculo de equilibrio */}
      <circle cx="200" cy="200" r="180" stroke="currentColor" strokeOpacity="0.22" strokeWidth="9" />
      {/* Eje de neutralidad */}
      <line
        x1="200"
        y1="56"
        x2="200"
        y2="344"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="6"
        strokeDasharray="12,14"
      />
      <g stroke="currentColor" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round">
        {/* Perfil izquierdo */}
        <path d="M 200,80 C 170,80 155,95 155,120 C 155,135 160,150 145,170 L 125,190 L 150,198 C 145,210 140,215 150,225 C 155,230 140,240 160,250 C 170,255 165,270 185,275 L 200,278" />
        <path d="M 175,145 Q 165,145 160,152" />
        <path d="M 180,132 Q 165,130 155,138" />
        {/* Perfil derecho */}
        <path d="M 200,80 C 230,80 245,95 245,120 C 245,135 240,150 255,170 L 275,190 L 250,198 C 255,210 260,215 250,225 C 245,230 260,240 240,250 C 230,255 235,270 215,275 L 200,278" />
        <path d="M 225,145 Q 235,145 240,152" />
        <path d="M 220,132 Q 235,130 245,138" />
        {/* Cuello unificado */}
        <path d="M 175,274 C 175,310 160,325 140,335 L 260,335 C 240,325 225,310 225,274" />
      </g>
    </svg>
  )
}
