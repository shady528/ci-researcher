'use client'
import AgentGraph     from './AgentGraph'
import RecentReports  from '@/components/left/RecentReports'
import { useAgentStore } from '@/store/agentStore'

export default function LeftPanel() {
  const leftCollapsed = useAgentStore((s) => s.leftCollapsed)
  const setCollapsed  = useAgentStore((s) => s.setLeftCollapsed)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      overflow: 'hidden', height: '100%',
      background: 'var(--surface)',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        justifyContent: leftCollapsed ? 'center' : 'space-between',
        flexShrink: 0,
      }}>
        {!leftCollapsed && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '.9px',
            textTransform: 'uppercase', color: 'var(--text3)',
          }}>
            Agent Workflow
          </span>
        )}
        <button
          onClick={() => setCollapsed(!leftCollapsed)}
          title={leftCollapsed ? 'Expand panel' : 'Collapse panel'}
          style={{
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            borderRadius: 5, cursor: 'pointer', color: 'var(--text2)',
            fontSize: 13, lineHeight: 1, padding: '3px 7px', transition: 'all .15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.color = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--border2)'
            e.currentTarget.style.color = 'var(--text2)'
          }}
        >
          {leftCollapsed ? '›' : '‹'}
        </button>
      </div>

      {/* Expanded */}
    {!leftCollapsed && (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Agent graph — fixed top section */}
        <div style={{ padding: 14, flexShrink: 0 }}>
        <AgentGraph />
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', flexShrink: 0 }} />

        {/* History — own scrollable section */}
        <div style={{
        flex: 1, overflowY: 'auto',
        padding: '12px 14px',
        }}>
        <RecentReports />
        </div>

    </div>
    )}
    
      {/* Collapsed — node icons only */}
      {leftCollapsed && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', paddingTop: 14, gap: 10,
        }}>
          {['📋', '🔍', '🛡', '🧠', '📊', '🚀'].map((icon, i) => (
            <div
              key={i}
              title={['Planner','Researcher','Validator','Analyst','Report','Notifier'][i]}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, background: 'var(--surface2)',
                border: '1px solid var(--border2)',
              }}
            >
              {icon}
            </div>
          ))}

          {/* History icon in collapsed state */}
          <div style={{ marginTop: 6, height: 1, width: 20, background: 'var(--border)' }} />
          <div
            title="Recent Reports"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, background: 'var(--surface2)',
              border: '1px solid var(--border2)',
            }}
          >
            🕘
          </div>
        </div>
      )}
    </div>
  )
}