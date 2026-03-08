'use client'
import { useAgentStore } from '@/store/agentStore'
import { useEffect, useState, useRef } from 'react'
import ModelConfigPanel from '@/components/settings/ModelConfig'

const PILLS = [
  { label: 'LangGraph',          accent: true  },
  { label: 'GPT-4o',             accent: true  },
  { label: 'Tavily',             accent: true  },
  { label: 'RAG',                green: true   },
  { label: 'Credibility Engine', green: true   },
  { label: 'Auto-Delivery',      green: true   },
]

interface TopNavProps {
  onRun:   () => void
  onReset: () => void
}

export default function TopNav({ onRun, onReset }: TopNavProps) {
  const phase       = useAgentStore((s) => s.phase)
  const theme       = useAgentStore((s) => s.theme)
  const setTheme    = useAgentStore((s) => s.setTheme)
  const delivery    = useAgentStore((s) => s.delivery)
  const setDelivery = useAgentStore((s) => s.setDelivery)
  const modelConfig = useAgentStore((s) => s.modelConfig)
  const busy        = phase === 'running' || phase === 'hitl'
  const isDark      = theme === 'dark'

  const [gearOpen,   setGearOpen]   = useState(false)
  const [activeTab,  setActiveTab]  = useState<'models' | 'delivery'>('models')
  const gearRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gearRef.current && !gearRef.current.contains(e.target as Node)) {
        setGearOpen(false)
      }
    }
    if (gearOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [gearOpen])

  // Dynamically update the GPT-4o pill to show the writer model
  const writerModel = MODELS_SHORT[modelConfig?.writer] ?? 'GPT-4o'

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', height: 50,
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      flexShrink: 0, zIndex: 20,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
        <div style={{
          width: 26, height: 26,
          background: 'linear-gradient(135deg, var(--accent2), var(--purple))',
          borderRadius: 7, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13,
        }}>
          🔍
        </div>
        CI Researcher
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 400, marginLeft: 2 }}>v2</span>
      </div>

      {/* Pills — writer model updates dynamically */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { label: 'LangGraph',          accent: true  },
          { label: writerModel,          accent: true  },
          { label: 'Tavily',             accent: true  },
          { label: 'RAG',                green: true   },
          { label: 'Credibility Engine', green: true   },
          { label: 'Auto-Delivery',      green: true   },
        ].map((p) => (
          <span key={p.label} style={{
            fontSize: 10, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
            border: `1px solid ${p.green ? 'var(--green)' : 'var(--accent)'}`,
            color:  p.green ? 'var(--green)' : 'var(--accent)',
            background: p.green ? 'rgba(31,207,114,.07)' : 'rgba(91,127,255,.08)',
          }}>
            {p.label}
          </span>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>

        <IconBtn
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? '☀️' : '🌙'}
        </IconBtn>

        {/* Settings gear — now with tabs */}
        <div ref={gearRef} style={{ position: 'relative' }}>
          <IconBtn
            title="Settings"
            onClick={() => setGearOpen((v) => !v)}
            active={gearOpen}
          >
            ⚙
          </IconBtn>

          {gearOpen && (
            <div style={{
              position: 'absolute', top: 38, right: 0,
              width: 340, background: 'var(--surface)',
              border: '1px solid var(--border2)', borderRadius: 10,
              boxShadow: '0 8px 32px rgba(0,0,0,.35)',
              zIndex: 100, animation: 'fadeIn .15s ease',
              overflow: 'hidden',
            }}>
              {/* Tab bar */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border)',
              }}>
                {(['models', 'delivery'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1, padding: '10px 0', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600,
                      background: 'transparent', border: 'none',
                      borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
                      color: activeTab === tab ? 'var(--accent)' : 'var(--text3)',
                      transition: 'all .15s',
                      textTransform: 'capitalize',
                    }}
                  >
                    {tab === 'models' ? '🤖 Models' : '📬 Delivery'}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{
                padding: 16,
                maxHeight: 520,
                overflowY: 'auto',
              }}>
                {activeTab === 'models' && <ModelConfigPanel />}
                {activeTab === 'delivery' && (
                  <div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '.7px', color: 'var(--text3)', marginBottom: 14,
                    }}>
                      Auto-Delivery
                    </div>

                    <DeliveryRow
                      icon="💬" label="Slack"
                      enabled={delivery.slackEnabled}
                      value={delivery.slackTarget}
                      placeholder="Webhook URL or #channel"
                      onToggle={() => setDelivery({ slackEnabled: !delivery.slackEnabled })}
                      onChange={(v) => setDelivery({ slackTarget: v })}
                    />

                    <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />

                    <DeliveryRow
                      icon="📧" label="Email"
                      enabled={delivery.emailEnabled}
                      value={delivery.emailTarget}
                      placeholder="recipient@company.com"
                      onToggle={() => setDelivery({ emailEnabled: !delivery.emailEnabled })}
                      onChange={(v) => setDelivery({ emailTarget: v })}
                    />

                    <div style={{
                      marginTop: 12, padding: '7px 10px', borderRadius: 6,
                      background: 'var(--surface2)', fontSize: 10, color: 'var(--text3)',
                      lineHeight: 1.5,
                    }}>
                      Reports are delivered automatically when the agent finishes.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: 'var(--border2)', margin: '0 2px' }} />

        <Btn label="↺ Reset"  onClick={onReset} disabled={busy} />
        <Btn label="⬇ Export" onClick={() => {}} />
      </div>
    </nav>
  )
}

// Short display names for the nav pill
const MODELS_SHORT: Record<string, string> = {
  'gpt-4o':            'GPT-4o',
  'gpt-4o-mini':       'GPT-4o mini',
  'gpt-4-turbo':       'GPT-4 Turbo',
  'claude-3-5-sonnet': 'Claude 3.5',
  'claude-3-haiku':    'Claude Haiku',
  'gemini-1.5-pro':    'Gemini Pro',
  'gemini-1.5-flash':  'Gemini Flash',
}

function IconBtn({ children, onClick, title, active }: {
  children: React.ReactNode; onClick: () => void
  title?: string; active?: boolean
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 32, height: 32, borderRadius: 7,
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
      background: active ? 'rgba(91,127,255,.1)' : 'var(--surface2)',
      cursor: 'pointer', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: 15, transition: 'all .15s',
      color: active ? 'var(--accent)' : 'inherit',
    }}>
      {children}
    </button>
  )
}

function Btn({ label, onClick, primary, disabled }: {
  label: string; onClick: () => void; primary?: boolean; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '4px 13px', borderRadius: 6, fontSize: 11, fontWeight: 500,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${primary ? 'var(--accent2)' : 'var(--border2)'}`,
      background: primary ? 'var(--accent2)' : 'transparent',
      color: primary ? '#fff' : 'var(--text2)',
      opacity: disabled ? 0.5 : 1, transition: 'all .15s',
    }}>
      {label}
    </button>
  )
}

function DeliveryRow({ icon, label, enabled, value, placeholder, onToggle, onChange }: {
  icon: string; label: string; enabled: boolean
  value: string; placeholder: string
  onToggle: () => void; onChange: (v: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: enabled ? 8 : 0 }}>
        <div onClick={onToggle} style={{
          width: 30, height: 16, borderRadius: 8, flexShrink: 0,
          background: enabled ? 'var(--green)' : 'var(--border2)',
          cursor: 'pointer', position: 'relative', transition: 'background .2s',
        }}>
          <div style={{
            position: 'absolute', width: 12, height: 12, borderRadius: '50%',
            background: '#fff', top: 2,
            left: enabled ? 16 : 2, transition: 'left .2s',
          }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{icon} {label}</span>
        {enabled && (
          <span style={{
            marginLeft: 'auto', fontSize: 9, fontWeight: 700,
            padding: '1px 5px', borderRadius: 3,
            background: 'rgba(31,207,114,.1)', color: 'var(--green)',
          }}>ON</span>
        )}
      </div>
      {enabled && (
        <input
          type="text" value={value} placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', background: 'var(--bg)',
            border: '1px solid var(--border2)', borderRadius: 6,
            color: 'var(--text)', fontFamily: 'Inter, sans-serif',
            fontSize: 11, padding: '6px 9px', outline: 'none',
            transition: 'border-color .15s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
          onBlur={(e)  => e.target.style.borderColor = 'var(--border2)'}
        />
      )}
    </div>
  )
}