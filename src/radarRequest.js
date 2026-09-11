/** Shared metadata requests with a real deadline, bounded retries and no cached errors. */
export function cachedRadarRequest(url, decode) {
  let cached = null
  return (maxAgeMs = 5 * 60_000) => {
    if (cached && (cached.pending || Date.now() - cached.at < maxAgeMs)) return cached.promise
    const entry = { at: Date.now(), pending: true }
    entry.promise = (async () => {
      for (let attempt = 0; ; attempt += 1) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 15_000)
        try {
          const response = await fetch(url, { signal: controller.signal, cache: 'no-cache' })
          if (!response.ok) throw new Error('Radardaten derzeit nicht erreichbar')
          const result = await decode(response)
          entry.pending = false
          return result
        } catch (error) {
          if (attempt >= 2) {
            if (cached === entry) cached = null
            throw error
          }
        } finally {
          clearTimeout(timer)
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
      }
    })()
    cached = entry
    return entry.promise
  }
}
