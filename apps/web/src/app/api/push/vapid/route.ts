import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Expone la clave pública VAPID al cliente para suscribirse.
export async function GET() {
  return NextResponse.json({
    publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || null,
  })
}
