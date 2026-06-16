import { useState, useEffect, useRef } from 'react'
import { registerSW } from 'virtual:pwa-register'

export function usePWAUpdate() {
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const updateFn = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    let onVisibility: (() => void) | undefined

    updateFn.current = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedsRefresh(true)
      },
      onRegisteredSW(_swUrl, registration) {
        if (!registration) return
        const check = () => registration.update()
        intervalId = setInterval(check, 60_000)
        onVisibility = () => {
          if (document.visibilityState === 'visible') check()
        }
        document.addEventListener('visibilitychange', onVisibility)
      },
    })

    return () => {
      if (intervalId !== undefined) clearInterval(intervalId)
      if (onVisibility) document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return {
    needsRefresh,
    installUpdate() {
      updateFn.current?.(true)
    },
  }
}
