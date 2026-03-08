'use client'
import { useAgentStore } from '@/store/agentStore'
import type { ReportTemplate } from '@/store/agentStore'
import TopicInput    from '@/components/center/TopicInput'
import ReportPanel   from '@/components/right/ReportPanel'
import HitlCard      from '@/components/center/HitlCard'
import DiffView from '@/components/center/DiffView'

interface CenterPanelProps {
  onRun: () => void
}

const EXAMPLE_TOPICS = [
  'Compare HubSpot vs Salesforce pricing and AI features in 2025',
  'Analyze the top 5 project management tools for enterprise teams',
  'Competitive landscape of AI coding assistants in 2025',
]

const TEMPLATES: {
  id: ReportTemplate; icon: string; label: string; sub: string
}[] = [
  { id: 'full',     icon: '📄', label: 'Full Analysis',      sub: 'Executive summary, matrix, trends, recommendations' },
  { id: 'briefing', icon: '⚡', label: 'Executive Briefing', sub: '1-page bullet summary, key findings only'            },
  { id: 'table',    icon: '📊', label: 'Comparison Table',   sub: 'Feature-by-feature table, minimal prose'            },
]

function getStep(percent: number): { icon: string; step: string; sub: string } {
  if (percent <= 14)  return { icon: '📋', step: 'Planning',     sub: 'Deciding what to search for'               }
  if (percent <= 28)  return { icon: '🔍', step: 'Searching',    sub: 'Looking across the web and your documents' }
  if (percent <= 44)  return { icon: '🔍', step: 'Searching',    sub: 'Collecting all relevant sources'           }
  if (percent <= 58)  return { icon: '🛡',  step: 'Verifying',    sub: 'Checking how reliable each source is'     }
  if (percent <= 66)  return { icon: '🧠', step: 'Reviewing',    sub: 'Identifying any missing information'       }
  if (percent <= 78)  return { icon: '🔍', step: 'Filling gaps', sub: 'Searching for what was missing'            }
  if (percent <= 88)  return { icon: '🧠', step: 'Confirming',   sub: 'Making sure everything is covered'         }
  if (percent <= 95)  return { icon: '✍️',  step: 'Writing',      sub: 'Putting together your report'             }
  if (percent < 100)  return { icon: '📬', step: 'Delivering',   sub: 'Sending to your configured channels'       }
  return               { icon: '✅', step: 'Done',          sub: 'Your report is ready'                       }
}

export default function CenterPanel({ onRun }: CenterPanelProps) {
  const { phase, progress, reportMd, hitlData, setTopic,
          reportTemplate, setReportTemplate, diffMode } = useAgentStore()

  const isIdle    = phase === 'idle'
  const isRunning = phase === 'running'
  const isHitl    = phase === 'hitl'
  const step      = getStep(progress.percent)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>

      {/* Input area */}
      <div style={{
        padding: '20px 28px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0,
      }}>
        <TopicInput onRun={onRun} />

        {/* Template picker — sits below input, hidden while running */}
        {!isRunning && !isHitl && (
          <div style={{ maxWidth: 720, margin: '10px auto 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                fontSize: 10, fontWeight: 700, color: 'var(--text3)',
                textTransform: 'uppercase', letterSpacing: '.6px',
                flexShrink: 0,
              }}>
                Output:
              </span>
              <div style={{ display: 'flex', gap: 5 }}>
                {TEMPLATES.map((t) => {
                  const active = reportTemplate === t.id
                  return (
                    <button
                      key={t.id}
                      onClick={() => setReportTemplate(t.id)}
                      title={t.sub}
                      style={{
                        padding: '4px 11px', borderRadius: 20,
                        fontSize: 11, fontWeight: 600,
                        cursor: 'pointer',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
                        background: active ? 'rgba(91,127,255,.12)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text3)',
                        transition: 'all .15s',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.borderColor = 'var(--accent)'
                          e.currentTarget.style.color = 'var(--text2)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.borderColor = 'var(--border2)'
                          e.currentTarget.style.color = 'var(--text3)'
                        }
                      }}
                    >
                      <span>{t.icon}</span>
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {/* Active template description */}
              <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>
                — {TEMPLATES.find((t) => t.id === reportTemplate)?.sub}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {(isRunning || isHitl) && progress.visible && (
        <div style={{
          padding: '10px 28px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface2)', flexShrink: 0,
        }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontSize: 11, marginBottom: 6, alignItems: 'center',
          }}>
            <span style={{ color: isHitl ? 'var(--purple)' : 'var(--accent)', fontWeight: 600 }}>
              {isHitl ? '⏸ Waiting for your approval…' : progress.label}
            </span>
            <span style={{ color: 'var(--text3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
              {progress.percent}%
            </span>
          </div>
          <div style={{ height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: isHitl
                ? 'linear-gradient(90deg, var(--purple), var(--accent))'
                : 'linear-gradient(90deg, var(--accent2), var(--purple))',
              width: `${progress.percent}%`, transition: 'width .5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Main body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

        {/* HITL */}
        {isHitl && hitlData && (
          <div style={{ maxWidth: 620, margin: '0 auto 28px' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 8, marginBottom: 12,
              background: 'rgba(157,127,240,.08)',
              border: '1px solid rgba(157,127,240,.25)',
            }}>
              <span style={{ fontSize: 18 }}>⏸</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--purple)' }}>
                  Your approval is needed
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                  Review the search plan before the agent spends API credits
                </div>
              </div>
            </div>
            <HitlCard />
          </div>
        )}

        {/* Idle empty state */}
        {isIdle && !reportMd && (
          <div style={{ maxWidth: 560, margin: '40px auto 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                What do you want to research?
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                Describe a competitive intelligence topic and the agent will
                research it, validate sources, and produce a structured report.
              </p>
            </div>

            <div>
              <div style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.7px', color: 'var(--text3)', marginBottom: 8,
              }}>
                Try an example
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {EXAMPLE_TOPICS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTopic(t)}
                    style={{
                      textAlign: 'left', padding: '10px 13px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border2)',
                      borderRadius: 8, cursor: 'pointer',
                      fontSize: 12, color: 'var(--text2)',
                      transition: 'all .15s', lineHeight: 1.4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--accent)'
                      e.currentTarget.style.color = 'var(--text)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border2)'
                      e.currentTarget.style.color = 'var(--text2)'
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Running step tracker */}
        {isRunning && !reportMd && (
          <div style={{ maxWidth: 480, margin: '60px auto 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '20px 24px', borderRadius: 12,
              background: 'var(--surface2)', border: '1px solid var(--border2)',
              marginBottom: 24, animation: 'fadeIn .3s ease',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, background: 'rgba(91,127,255,.1)',
                border: '1px solid rgba(91,127,255,.2)',
                animation: 'glow 1.4s ease-in-out infinite',
              }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>
                  {step.step}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                  {step.sub}
                </div>
              </div>
            </div>

            {/* Template reminder while running */}
            <div style={{
              display: 'flex', justifyContent: 'center', marginBottom: 20,
            }}>
              <div style={{
                fontSize: 10, color: 'var(--text3)',
                padding: '4px 10px', borderRadius: 20,
                background: 'var(--surface2)', border: '1px solid var(--border2)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {TEMPLATES.find((t) => t.id === reportTemplate)?.icon}
                <span>Writing as <strong style={{ color: 'var(--text2)' }}>
                  {TEMPLATES.find((t) => t.id === reportTemplate)?.label}
                </strong></span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {[
                { label: 'Plan',    pct: 7  },
                { label: 'Search',  pct: 28 },
                { label: 'Verify',  pct: 58 },
                { label: 'Review',  pct: 66 },
                { label: 'Write',   pct: 88 },
                { label: 'Deliver', pct: 95 },
              ].map((s, i, arr) => {
                const done    = progress.percent > s.pct
                const current = progress.percent <= s.pct &&
                                (i === 0 || progress.percent > arr[i - 1].pct)
                return (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', margin: '0 auto 4px',
                        background: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--border2)',
                        transition: 'background .3s',
                        animation: current ? 'blink 1.2s infinite' : 'none',
                      }} />
                      <div style={{
                        fontSize: 9,
                        color: done ? 'var(--green)' : current ? 'var(--accent)' : 'var(--text3)',
                        fontWeight: current || done ? 600 : 400,
                        transition: 'color .3s',
                      }}>
                        {s.label}
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div style={{
                        width: 20, height: 1, marginBottom: 13,
                        background: done ? 'var(--green)' : 'var(--border2)',
                        transition: 'background .3s',
                      }} />
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text3)' }}>
              Follow every step in detail in the live log →
            </div>
          </div>
        )}

        {/* Diff view */}
        {diffMode && (
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <DiffView />
          </div>
        )}

        {/* Report */}
        {reportMd && !diffMode && (
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <ReportPanel />
          </div>
        )}
      </div>
    </div>
  )
}
