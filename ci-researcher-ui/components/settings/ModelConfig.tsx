'use client'
import { useState } from 'react'
import { useAgentStore } from '@/store/agentStore'
import type { ModelId, EmbeddingModelId, ResearchDepth } from '@/store/agentStore'

// ── Model catalogue ──────────────────────────────────────────
const MODELS: {
  id: ModelId; label: string; provider: string
  inputPer1M: number; outputPer1M: number; badge?: string
}[] = [
  { id: 'gpt-4o',            label: 'GPT-4o',           provider: 'OpenAI',    inputPer1M: 5,    outputPer1M: 15,   badge: 'Best'    },
  { id: 'gpt-4o-mini',       label: 'GPT-4o mini',      provider: 'OpenAI',    inputPer1M: 0.15, outputPer1M: 0.6,  badge: 'Fast'    },
  { id: 'gpt-4-turbo',       label: 'GPT-4 Turbo',      provider: 'OpenAI',    inputPer1M: 10,   outputPer1M: 30                     },
  { id: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'Anthropic', inputPer1M: 3,    outputPer1M: 15,   badge: 'Smart'   },
  { id: 'claude-3-haiku',    label: 'Claude 3 Haiku',    provider: 'Anthropic', inputPer1M: 0.25, outputPer1M: 1.25, badge: 'Cheap'   },
  { id: 'gemini-1.5-pro',    label: 'Gemini 1.5 Pro',    provider: 'Google',    inputPer1M: 1.25, outputPer1M: 5                      },
  { id: 'gemini-1.5-flash',  label: 'Gemini 1.5 Flash',  provider: 'Google',    inputPer1M: 0.075,outputPer1M: 0.3,  badge: 'Fastest' },
]

const EMBEDDING_MODELS: { id: EmbeddingModelId; label: string; costPer1M: number }[] = [
  { id: 'text-embedding-3-small', label: 'text-embedding-3-small', costPer1M: 0.02  },
  { id: 'text-embedding-3-large', label: 'text-embedding-3-large', costPer1M: 0.13  },
  { id: 'text-embedding-ada-002', label: 'text-embedding-ada-002', costPer1M: 0.10  },
]

// Rough token estimates per role per run
const TOKEN_ESTIMATES: Record<string, { input: number; output: number }> = {
  planner:    { input: 600,  output: 250  },
  researcher: { input: 1200, output: 600  },
  validator:  { input: 2000, output: 350  },
  analyst:    { input: 3500, output: 600  },
  writer:     { input: 5000, output: 2500 },
}

const DEPTH_OPTIONS: { id: ResearchDepth; label: string; sub: string; iterations: number; queries: number }[] = [
  { id: 'quick',    label: 'Quick',    sub: '1 pass · 3 queries · ~30s',  iterations: 1, queries: 3  },
  { id: 'standard', label: 'Standard', sub: '2 passes · 5 queries · ~90s', iterations: 2, queries: 5  },
  { id: 'deep',     label: 'Deep',     sub: '3 passes · 8 queries · ~3m',  iterations: 3, queries: 8  },
]

const ROLES: { key: keyof Pick<ReturnType<typeof useAgentStore.getState>['modelConfig'],
  'planner'|'researcher'|'validator'|'analyst'|'writer'>
  label: string; icon: string; desc: string }[] = [
  { key: 'planner',    label: 'Planner',       icon: '📋', desc: 'Generates the search strategy' },
  { key: 'researcher', label: 'Researcher',    icon: '🔍', desc: 'Calls search tools and retrieves docs' },
  { key: 'validator',  label: 'Validator',     icon: '🛡', desc: 'Scores source credibility' },
  { key: 'analyst',    label: 'Analyst',       icon: '🧠', desc: 'Identifies gaps and approves data' },
  { key: 'writer',     label: 'Report Writer', icon: '✍️', desc: 'Synthesizes the final report' },
]

function calcCost(modelId: ModelId, role: string): number {
  const model  = MODELS.find((m) => m.id === modelId)
  const tokens = TOKEN_ESTIMATES[role]
  if (!model || !tokens) return 0
  return (tokens.input / 1_000_000) * model.inputPer1M +
         (tokens.output / 1_000_000) * model.outputPer1M
}

function totalCost(config: ReturnType<typeof useAgentStore.getState>['modelConfig']): string {
  const roles = ['planner','researcher','validator','analyst','writer'] as const
  const total = roles.reduce((sum, r) => sum + calcCost(config[r], r), 0)
  const mult  = config.depth === 'quick' ? 0.5 : config.depth === 'deep' ? 2 : 1
  return (total * mult).toFixed(4)
}

export default function ModelConfigPanel() {
  const { modelConfig, setModelConfig, setTemperature } = useAgentStore()
  const [showTemp, setShowTemp] = useState(false)

  return (
    <div>
      {/* Research Depth */}
      <div style={{ marginBottom: 16 }}>
        <SectionLabel>Research Depth</SectionLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          {DEPTH_OPTIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => setModelConfig({ depth: d.id })}
              style={{
                flex: 1, padding: '7px 6px', borderRadius: 7, cursor: 'pointer',
                border: `1px solid ${modelConfig.depth === d.id ? 'var(--accent)' : 'var(--border2)'}`,
                background: modelConfig.depth === d.id ? 'rgba(91,127,255,.1)' : 'var(--surface2)',
                transition: 'all .15s', textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: 11, fontWeight: 700,
                color: modelConfig.depth === d.id ? 'var(--accent)' : 'var(--text2)',
              }}>
                {d.label}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>
                {d.sub}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: 'var(--border)', marginBottom: 14 }} />

      {/* Per-role model selectors */}
      <SectionLabel>Model per Role</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
        {ROLES.map((role) => {
          const selected = MODELS.find((m) => m.id === modelConfig[role.key])
          const cost     = calcCost(modelConfig[role.key], role.key)
          const depthMult = modelConfig.depth === 'quick' ? 0.5 : modelConfig.depth === 'deep' ? 2 : 1

          return (
            <div key={role.key}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12 }}>{role.icon}</span>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>
                      {role.label}
                    </span>
                    <div style={{ fontSize: 9, color: 'var(--text3)' }}>{role.desc}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: 9, color: 'var(--text3)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  ~${(cost * depthMult).toFixed(4)}
                </span>
              </div>

              <select
                value={modelConfig[role.key]}
                onChange={(e) => setModelConfig({ [role.key]: e.target.value as ModelId })}
                style={{
                  width: '100%', background: 'var(--bg)',
                  border: '1px solid var(--border2)', borderRadius: 6,
                  color: 'var(--text)', fontSize: 11, padding: '5px 8px',
                  outline: 'none', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.provider}){m.badge ? ` — ${m.badge}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      {/* Embedding model */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>🔢</span>
            <div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)' }}>Embeddings</span>
              <div style={{ fontSize: 9, color: 'var(--text3)' }}>Used for internal doc RAG</div>
            </div>
          </div>
        </div>
        <select
          value={modelConfig.embedding}
          onChange={(e) => setModelConfig({ embedding: e.target.value as EmbeddingModelId })}
          style={{
            width: '100%', background: 'var(--bg)',
            border: '1px solid var(--border2)', borderRadius: 6,
            color: 'var(--text)', fontSize: 11, padding: '5px 8px',
            outline: 'none', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {EMBEDDING_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — ${m.costPer1M}/1M tokens
            </option>
          ))}
        </select>
      </div>

      <div style={{ height: 1, background: 'var(--border)', marginBottom: 12 }} />

      {/* Temperature controls — collapsed by default */}
      <button
        onClick={() => setShowTemp((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '6px 8px',
          borderRadius: 6, background: 'var(--surface2)',
          border: '1px solid var(--border2)', cursor: 'pointer',
          fontSize: 11, color: 'var(--text2)', fontWeight: 600,
          marginBottom: showTemp ? 10 : 0,
        }}
      >
        <span>🌡 Temperature per node</span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>{showTemp ? '▲' : '▼'}</span>
      </button>

      {showTemp && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, animation: 'fadeIn .15s ease' }}>
          {(['planner','researcher','analyst','writer'] as const).map((role) => {
            const val  = modelConfig.temperatures[role]
            const meta = ROLES.find((r) => r.key === role)
            const label = val <= 0.2 ? 'Focused' : val <= 0.5 ? 'Balanced' : val <= 0.7 ? 'Creative' : 'Wild'
            const labelColor = val <= 0.2 ? 'var(--green)' : val <= 0.5 ? 'var(--accent)' : val <= 0.7 ? 'var(--yellow)' : 'var(--red)'

            return (
              <div key={role}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginBottom: 4,
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}>
                    {meta?.icon} {meta?.label}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: labelColor,
                      padding: '1px 5px', borderRadius: 3,
                      background: `${labelColor}15`,
                    }}>
                      {label}
                    </span>
                    <span style={{
                      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
                      color: 'var(--text3)', width: 28, textAlign: 'right',
                    }}>
                      {val.toFixed(1)}
                    </span>
                  </div>
                </div>
                <input
                  type="range" min={0} max={1} step={0.1}
                  value={val}
                  onChange={(e) => setTemperature(role, parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Estimated total cost */}
      <div style={{
        marginTop: 14, padding: '8px 11px', borderRadius: 7,
        background: 'var(--bg)', border: '1px solid var(--border2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>
          Estimated cost per run
        </span>
        <span style={{
          fontSize: 12, fontWeight: 700, color: 'var(--accent)',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          ~${totalCost(modelConfig)}
        </span>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '.7px', color: 'var(--text3)', marginBottom: 10,
    }}>
      {children}
    </div>
  )
}