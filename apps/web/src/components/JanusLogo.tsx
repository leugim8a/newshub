// Logo de Jano (Janus): medallón clásico de dos rostros barbados en espejo (doble
// perspectiva / neutralidad). Ilustración dorada sobre fondo transparente.
export function JanusLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/janus.png" alt="NewsHub" className={className} draggable={false} />
  )
}
