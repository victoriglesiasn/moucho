// Descarga directa desde la propia web: /descargar/moucho
// Cloudflare Pages no admite archivos de más de 25 MB, así que el instalador
// está guardado en trozos (descargas/<app>/part-XX.bin) y aquí se juntan al vuelo
// en un único archivo .exe, sin pasar por ningún otro servidor.
export async function onRequest({ params, request, env, waitUntil }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método no permitido', { status: 405 })
  const app = String(params.app || '').toLowerCase().replace(/[^a-z0-9-]/g, '')
  const base = new URL(request.url)
  const res = await env.ASSETS.fetch(new URL(`/descargas/${app}.json`, base))
  if (!res.ok) return new Response('No encontrado', { status: 404 })
  const m = await res.json()
  const headers = {
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `attachment; filename="${m.filename}"`,
    'Content-Length': String(m.size),
    'Cache-Control': 'public, max-age=600',
    'X-Content-Type-Options': 'nosniff',
  }
  if (request.method === 'HEAD') return new Response(null, { headers })
  const { readable, writable } = new FixedLengthStream(m.size)
  const pump = (async () => {
    for (const p of m.parts) {
      const r = await env.ASSETS.fetch(new URL(`/descargas/${app}/${p}`, base))
      if (!r.ok || !r.body) throw new Error('Falta un trozo: ' + p)
      await r.body.pipeTo(writable, { preventClose: true })
    }
    await writable.close()
  })().catch(e => writable.abort(e))
  waitUntil(pump)
  return new Response(readable, { headers })
}
