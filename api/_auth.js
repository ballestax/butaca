// Verifica el token de sesión de Supabase (JWT firmado con ES256) contra la clave
// pública del proyecto. No hay ningún secreto: sólo hace falta SUPABASE_URL.
//
// Mientras la web antigua siga usando el proxy sin sesión, las peticiones sin token
// se aceptan. Cuando REQUIRE_AUTH=true en Vercel, se exige token en todas.

import { createRemoteJWKSet, jwtVerify } from 'jose'

let jwks
let jwksUrl

function claves(base) {
  const url = `${base}/auth/v1/.well-known/jwks.json`
  if (!jwks || jwksUrl !== url) {
    jwks = createRemoteJWKSet(new URL(url))
    jwksUrl = url
  }
  return jwks
}

/** @returns {Promise<{ok: true, userId: string | null} | {ok: false, status: number, error: string}>} */
export async function authenticate(req) {
  const header = req.headers.authorization || ''
  const token = header.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    if (process.env.REQUIRE_AUTH === 'true') {
      return { ok: false, status: 401, error: 'Falta la sesión' }
    }
    return { ok: true, userId: null }
  }

  const base = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '')
  if (!base) return { ok: false, status: 500, error: 'Falta SUPABASE_URL' }

  try {
    const { payload } = await jwtVerify(token, claves(base), {
      issuer: `${base}/auth/v1`,
      audience: 'authenticated'
    })
    return { ok: true, userId: payload.sub ?? null }
  } catch {
    return { ok: false, status: 401, error: 'Sesión inválida o caducada' }
  }
}
