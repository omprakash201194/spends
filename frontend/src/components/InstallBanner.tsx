import { Download, X } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'

/**
 * Floats above the bottom nav on mobile only.
 * Renders nothing if the browser doesn't fire beforeinstallprompt
 * (Safari, already-installed apps, user previously dismissed).
 */
export default function InstallBanner() {
  const { canInstall, promptInstall, dismiss } = useInstallPrompt()

  if (!canInstall) return null

  return (
    <div
      className="md:hidden print:hidden fixed inset-x-0 z-20 mx-4"
      style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="bg-blue-700 dark:bg-blue-800 text-white rounded-xl p-3 flex items-center gap-3 shadow-lg">
        <Download className="w-5 h-5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Install SpendStack</p>
          <p className="text-xs text-blue-200 leading-tight">Add to your home screen</p>
        </div>
        <button
          onClick={promptInstall}
          className="px-3 py-1.5 bg-white text-blue-700 text-xs font-semibold rounded-lg flex-shrink-0 hover:bg-blue-50 transition-colors"
        >
          Install
        </button>
        <button
          onClick={dismiss}
          className="p-1 text-blue-200 hover:text-white flex-shrink-0 transition-colors"
          aria-label="Dismiss install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
