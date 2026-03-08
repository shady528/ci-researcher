import { useEffect, useRef } from 'react'
import { useAgentStore } from '@/store/agentStore'

export function useElapsedTimer() {
  const setElapsed  = useAgentStore((s) => s.setElapsed)
  const isRunning   = useAgentStore((s) => s.isRunning)
  const startRef    = useRef<number | null>(null)
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isRunning) {
      startRef.current = Date.now()
      timerRef.current = setInterval(() => {
        const secs = ((Date.now() - (startRef.current ?? Date.now())) / 1000).toFixed(1)
        setElapsed(`${secs}s`)
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isRunning, setElapsed])
}