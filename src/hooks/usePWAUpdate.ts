import { useState, useEffect, useRef } from 'react'
import { registerSW } from 'virtual:pwa-register'

// An update found as the app opens is installed straight away, before anyone
// is using it. One found later (the browser checks now and then, e.g. when a
// notification arrives) waits for the Install button, so the app never reloads
// while someone's in it.
//
// The exception is an app left open for hours: a tab or home-screen app that's
// been hidden or untouched for STALE_MS is checked as soon as someone comes
// back, and an update found then (or already waiting) is installed straight
// away, before they start using it. Otherwise a copy left open for weeks never
// picks up fixes, such as the ones that stop it syncing while nobody's looking.
const FRESH_OPEN_MS = 10_000
const STALE_MS = 6 * 60 * 60_000
/** How long after coming back an update found still counts as "on return". */
const RETURN_WINDOW_MS = 15_000

export function usePWAUpdate() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const updateFn = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    let registration: ServiceWorkerRegistration | undefined
    let waiting = false
    let returnedAt = -Infinity
    let lastSeen = Date.now()

    updateFn.current = registerSW({
      immediate: true,
      onRegisteredSW(_url, r) {
        registration = r
      },
      onNeedRefresh() {
        waiting = true
        const onReturn = performance.now() < FRESH_OPEN_MS || Date.now() - returnedAt < RETURN_WINDOW_MS
        if (onReturn) updateFn.current?.(true)
        else setNeedsRefresh(true)
      },
    })

    // Back after a long time away (hidden, or on screen with nobody using it).
    const back = () => {
      const away = Date.now() - lastSeen
      lastSeen = Date.now()
      if (away < STALE_MS) return
      returnedAt = Date.now()
      if (waiting) updateFn.current?.(true)
      else registration?.update().catch(() => {})
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') back()
      else lastSeen = Date.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pageshow', back)
    window.addEventListener('pointerdown', back, { capture: true, passive: true })
    window.addEventListener('keydown', back, { capture: true })
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pageshow', back)
      window.removeEventListener('pointerdown', back, { capture: true })
      window.removeEventListener('keydown', back, { capture: true })
    }
  }, [])

  return {
    needsRefresh,
    installUpdate() {
      updateFn.current?.(true)
    },
  }
}
