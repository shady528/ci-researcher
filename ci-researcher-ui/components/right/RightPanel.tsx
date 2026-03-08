'use client'
import { useAgentStore } from '@/store/agentStore'
import ThoughtStream   from '@/components/right/ThoughtStream'
import StateViewer     from './StateViewer'
import CredibilityPanel from './CredibilityPanel'
import DeliveryPanel   from './DeliveryPanel'

const TABS = [
  { id: 'stream',   label: '💭 Live Log'    },
  { id: 'state',    label: '{ } State'      },
  { id: 'cred',     label: '🛡 Sources'     },
  { id: 'delivery', label: '📬 Delivery'    },
] as const

export default function RightPanel() {
  const { activeTab, setActiveTab, phase } = useAgentStore()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px 0',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '.9px',
          textTransform: 'uppercase', color: 'var(--text3)',
          marginBottom: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>Activity</span>
          <PhaseChip phase={phase} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                flex: 1, padding: '6px 4px',
                fontSize: 10, fontWeight: 600,
                textAlign: 'center', cursor: 'pointer',
                color: activeTab === t.id ? 'var(--accent)' : 'var(--text3)',
                borderBottom: activeTab === t.id
                  ? '2px solid var(--accent)'
                  : '2px solid transparent',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                background: 'transparent',
                transition: 'all .15s',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

      {/* Tab content */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: activeTab === 'stream' ? '12px 12px' : '14px',
        borderLeft: '1px solid var(--border)',
      }}>
        {activeTab === 'stream'   && <ThoughtStream />}
        {activeTab === 'state'    && <StateViewer />}
        {activeTab === 'cred'     && <CredibilityPanel />}
        {activeTab === 'delivery' && <DeliveryPanel />}
      </div>
    </div>
  )
}

function PhaseChip({ phase }: { phase: string }) {
  const map: Record<string, { label: string; color: string }> = {
    idle:     { label: 'Idle',       color: 'var(--text3)'  },
    running:  { label: '● Running',  color: 'var(--accent)' },
    hitl:     { label: '⏸ Paused',   color: 'var(--purple)' },
    complete: { label: '✓ Done',     color: 'var(--green)'  },
    error:    { label: '✗ Error',    color: 'var(--red)'    },
  }
  const s = map[phase] ?? map.idle
  return <span style={{ fontSize: 10, color: s.color }}>{s.label}</span>
}