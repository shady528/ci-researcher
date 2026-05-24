'use client'
import { useCallback, useRef, useState } from 'react'
import TopNav        from './layout/TopNav'
import StatusBar     from './layout/StatusBar'
import ResizeHandle  from './layout/ResizeHandle'
import LeftPanel     from './left/LeftPanel'
import CenterPanel   from './center/CenterPanel'
import RightPanel    from './right/RightPanel'
import { useAgentStore }   from '@/store/agentStore'
import { useAgentStream }  from '@/hooks/useAgentStream'
import { useElapsedTimer } from '@/hooks/useElapsedTimer'
import { useIsMobile }     from '@/hooks/useIsMobile'

const MIN_SIDE  = 52
const MIN_PANEL = 200
const MAX_LEFT  = 420
const MAX_RIGHT = 520

type MobileTab = 'left' | 'center' | 'right'

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: 'left',   icon: '🔀', label: 'Workflow'  },
  { id: 'center', icon: '🔍', label: 'Research'  },
  { id: 'right',  icon: '📡', label: 'Activity'  },
]

export default function Dashboard() {
  const { reset, phase, leftCollapsed } = useAgentStore()
  const { run, cleanup }  = useAgentStream()
  const runningRef        = useRef(false)
  const isMobile          = useIsMobile()
  useElapsedTimer()

  const [leftW,      setLeftW]      = useState(280)
  const [rightW,     setRightW]     = useState(340)
  const [activeTab,  setActiveTab]  = useState<MobileTab>('center')

  const onLeftDrag  = useCallback((delta: number) => {
    setLeftW((w)  => Math.min(MAX_LEFT,  Math.max(MIN_PANEL, w + delta)))
  }, [])
  const onRightDrag = useCallback((delta: number) => {
    setRightW((w) => Math.min(MAX_RIGHT, Math.max(MIN_PANEL, w - delta)))
  }, [])

  const handleRun = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    // On mobile, switch to activity tab when run starts so user sees live log
    if (isMobile) setActiveTab('right')
    try { await run() }
    finally { runningRef.current = false }
  }, [run, isMobile])

  const handleReset = useCallback(async () => {
    if (phase === 'running') return
    await cleanup()
    reset()
  }, [phase, reset, cleanup])

  const effectiveLeftW = leftCollapsed ? MIN_SIDE : leftW

  // ── Mobile layout ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100dvh', overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        {/* Compact top nav */}
        <TopNav onRun={handleRun} onReset={handleReset} mobile />

        {/* Panel container */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <PanelSlide active={activeTab === 'left'}>
            <LeftPanel />
          </PanelSlide>
          <PanelSlide active={activeTab === 'center'}>
            <CenterPanel onRun={handleRun} />
          </PanelSlide>
          <PanelSlide active={activeTab === 'right'}>
            <RightPanel />
          </PanelSlide>
        </div>

        {/* Bottom tab bar */}
        <div style={{
          display: 'flex',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}>
          {MOBILE_TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  flex: 1, padding: '10px 0', display: 'flex',
                  flexDirection: 'column', alignItems: 'center', gap: 3,
                  background: 'transparent', border: 'none',
                  cursor: 'pointer', transition: 'all .15s',
                  borderTop: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                <span style={{ fontSize: 18 }}>{tab.icon}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: active ? 'var(--accent)' : 'var(--text3)',
                  transition: 'color .15s',
                }}>
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>

        <StatusBar />
      </div>
    )
  }

  // ── Desktop layout (unchanged) ────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <TopNav onRun={handleRun} onReset={handleReset} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{
          width: effectiveLeftW, flexShrink: 0,
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'width .2s ease',
        }}>
          <LeftPanel />
        </div>

        <ResizeHandle onDrag={onLeftDrag} />

        <div style={{
          flex: 1, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', minWidth: MIN_PANEL,
        }}>
          <CenterPanel onRun={handleRun} />
        </div>

        <ResizeHandle onDrag={onRightDrag} />

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

// Slides panel in/out — GPU-accelerated, no layout reflow
function PanelSlide({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      transform: active ? 'translateX(0)' : 'translateX(100%)',
      opacity: active ? 1 : 0,
      transition: 'transform .25s cubic-bezier(0.4,0,0.2,1), opacity .2s ease',
      pointerEvents: active ? 'auto' : 'none',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}