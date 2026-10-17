import { useState, useEffect, useRef } from 'react'
import { registerSW } from 'virtual:pwa-register'

// An update found as the app opens is installed straight away, before anyone
// is using it. One found later (the browser checks now and then, e.g. when a
// notification arrives) waits for the Install button, so the app never reloads
// while someone's in it. There's no checking on a timer or on switching back.
const FRESH_OPEN_MS = 10_000

export function usePWAUpdate() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const updateFn = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    updateFn.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        if (performance.now() < FRESH_OPEN_MS) updateFn.current?.(true)
        else setNeedsRefresh(true)
      },
    })
  }, [])

  return {
    needsRefresh,
    installUpdate() {
      updateFn.current?.(true)
    },
  }
}
