'use client'
import { useCallback, useRef, useState } from 'react'
import TopNav       from './layout/TopNav'
import StatusBar    from './layout/StatusBar'
import ResizeHandle from './layout/ResizeHandle'
import LeftPanel    from './left/LeftPanel'
import CenterPanel  from './center/CenterPanel'
import RightPanel   from './right/RightPanel'
import { useAgentStore }   from '@/store/agentStore'
import { runDemoSequence } from '@/lib/demoRunner'
import { useElapsedTimer } from '@/hooks/useElapsedTimer'

const MIN_SIDE  = 52   // collapsed left panel width
const MIN_PANEL = 200
const MAX_LEFT  = 420
const MAX_RIGHT = 520

export default function Dashboard() {
  const { reset, phase, leftCollapsed } = useAgentStore()
  const runningRef = useRef(false)
  useElapsedTimer()

  const [leftW,  setLeftW]  = useState(280)
  const [rightW, setRightW] = useState(340)

  const onLeftDrag  = useCallback((delta: number) => {
    setLeftW((w) => Math.min(MAX_LEFT,  Math.max(MIN_PANEL, w + delta)))
  }, [])
  const onRightDrag = useCallback((delta: number) => {
    setRightW((w) => Math.min(MAX_RIGHT, Math.max(MIN_PANEL, w - delta)))
  }, [])

  const handleRun = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    try { await runDemoSequence() }
    finally { runningRef.current = false }
  }, [])

  const handleReset = useCallback(() => {
    if (phase === 'running') return
    reset()
  }, [phase, reset])

  const effectiveLeftW = leftCollapsed ? MIN_SIDE : leftW

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav onRun={handleRun} onReset={handleReset} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left — agent workflow, collapsible */}
        <div style={{
          width: effectiveLeftW, flexShrink: 0,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'width .2s ease',
        }}>
          <LeftPanel />
        </div>

        <ResizeHandle onDrag={onLeftDrag} />

        {/* Center — the product, main focus */}
        <div style={{
          flex: 1, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          minWidth: MIN_PANEL,
        }}>
          <CenterPanel onRun={handleRun} />
        </div>

        <ResizeHandle onDrag={onRightDrag} />

        {/* Right — live log + technical details */}
        <div style={{
          width: rightW, flexShrink: 0,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          <RightPanel />
        </div>
      </div>

      <StatusBar />
    </div>
  )
}