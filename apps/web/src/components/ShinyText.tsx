'use client'

// Texto con brillo deslizante (portado de voicebox, sin framer-motion).
import { useEffect, useRef, type CSSProperties } from 'react'

interface ShinyTextProps {
  text: string
  speed?: number
  className?: string
  color?: string
  shineColor?: string
}

export default function ShinyText({
  text,
  speed = 3,
  className = '',
  color = 'hsl(var(--muted-foreground))',
  shineColor = 'hsl(var(--accent))',
}: ShinyTextProps) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = ((now - start) / (speed * 1000)) % 1
      el.style.backgroundPosition = `${150 - p * 200}% center`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed])

  const style: CSSProperties = {
    backgroundImage: `linear-gradient(120deg, ${color} 0%, ${color} 35%, ${shineColor} 50%, ${color} 65%, ${color} 100%)`,
    backgroundSize: '200% auto',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  }

  return (
    <span ref={ref} className={`inline-block ${className}`} style={style}>
      {text}
    </span>
  )
}
