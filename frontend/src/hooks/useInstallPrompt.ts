import { useState, useEffect } from 'react'

/**
 * BeforeInstallPromptEvent is not yet in the standard TypeScript DOM lib.
 * We define the subset we actually use.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'spends-install-dismissed'

/**
 * Captures the browser's beforeinstallprompt event (Chrome / Edge / Android)
 * and exposes controls for showing or permanently dismissing the install prompt.
 *
 * `canInstall` is false when:
 *  - the app is already installed (browser suppresses the event)
 *  - the user previously dismissed the banner (stored in localStorage)
 *  - the browser doesn't support the PWA install API (Safari, Firefox)
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true'
  )

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  const dismiss = () => {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  return {
    canInstall: deferredPrompt !== null && !dismissed,
    promptInstall,
    dismiss,
  }
}
