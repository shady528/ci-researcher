'use client'
import { useState } from 'react'
import type { ThoughtCardData, AvatarVariant, StatusChip } from '@/types/agent'

const AVATAR_STYLES: Record<AvatarVariant, { bg: string; color: string; label: string }> = {
  system:     { bg:'rgba(91,127,255,.15)',   color:'var(--accent)',  label:'⚡' },
  planner:    { bg:'rgba(91,127,255,.2)',    color:'var(--accent)',  label:'P'  },
  researcher: { bg:'rgba(31,207,114,.14)',   color:'var(--green)',   label:'R'  },
  validator:  { bg:'rgba(240,192,64,.1)',    color:'var(--yellow)',  label:'V'  },
  analyst:    { bg:'rgba(157,127,240,.12)',  color:'var(--purple)',  label:'A'  },
  report:     { bg:'rgba(255,140,66,.1)',    color:'var(--orange)',  label:'RG' },
  notifier:   { bg:'rgba(23,204,224,.1)',    color:'var(--cyan)',    label:'N'  },
}

const CHIP_STYLES: Record<StatusChip, { bg: string; color: string; label: string }> = {
  running:  { bg:'rgba(91,127,255,.13)',  color:'var(--accent)',  label:'Running'   },
  complete: { bg:'rgba(31,207,114,.1)',   color:'var(--green)',   label:'Complete'  },
  gap:      { bg:'rgba(240,192,64,.1)',   color:'var(--yellow)',  label:'Gap Found' },
  sending:  { bg:'rgba(255,140,66,.1)',   color:'var(--orange)',  label:'Sending'   },
  failed:   { bg:'rgba(255,79,79,.1)',    color:'var(--red)',     label:'Failed'    },
}

// Plain English explanation for each node
const NODE_EXPLAINERS: Record<AvatarVariant, { what: string; why: string; next: string }> = {
  system: {
    what: 'The system is initializing the agent graph and setting up the research environment.',
    why:  'Before any work begins, the graph needs to know your topic, source mode, and which documents are available.',
    next: 'The Planner node takes over to decide what to search for.',
  },
  planner: {
    what: 'The Planner decides what questions to ask and which search queries will best cover your topic.',
    why:  'Good research starts with a good plan. Without targeted queries, the agent would retrieve too much irrelevant information and miss key details.',
    next: 'The search plan is sent to you for approval before any API credits are spent.',
  },
  researcher: {
    what: 'The Researcher fires search queries against the web (via Tavily) and your internal documents (via ChromaDB).',
    why:  'This is where real data is collected. The more targeted the queries from the Planner, the higher-quality documents are retrieved here.',
    next: 'All retrieved documents are passed to the Validator to check their reliability.',
  },
  validator: {
    what: 'The Validator scores every source for credibility — checking domain authority, recency, source type, and consistency.',
    why:  'Not all sources are equal. A Reddit post and an official SEC filing should be weighted very differently in a compliance report.',
    next: 'Scored documents are passed to the Analyst to check whether enough good information was found.',
  },
  analyst: {
    what: 'The Analyst reviews all collected information and checks whether the research is complete or if there are gaps.',
    why:  'The agent needs to know when to stop searching. The Analyst acts as a quality gate — if key information is missing, it sends the Researcher back out.',
    next: 'If gaps are found, the Researcher runs again with targeted gap-filling queries. If data is sufficient, the Report Generator takes over.',
  },
  report: {
    what: 'The Report Generator synthesizes all validated documents into a structured, readable report.',
    why:  'Raw search results need to be distilled into something actionable. This node organises findings into sections, tables, and recommendations.',
    next: 'The finished report is displayed in the center panel and sent to the Notifier for delivery.',
  },
  notifier: {
    what: 'The Notifier delivers the completed report to your configured channels — Slack, email, or both.',
    why:  'Research is only useful if it reaches the right people. Automated delivery means your team gets the report without anyone having to remember to share it.',
    next: 'The run is complete. The report is saved to history.',
  },
}

export default function ThoughtCard({ card }: { card: ThoughtCardData }) {
  const [showExplainer, setShowExplainer] = useState(false)

  const av      = AVATAR_STYLES[card.avatar] ?? AVATAR_STYLES.system
  const chip    = CHIP_STYLES[card.status]   ?? CHIP_STYLES.running
  const explain = NODE_EXPLAINERS[card.avatar] ?? NODE_EXPLAINERS.system

  return (
    <div className="fade-in" style={{
      borderRadius: 9, border: '1px solid var(--border2)',
      background: 'var(--surface2)', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '9px 13px', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 22, height: 22, borderRadius: 5,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, flexShrink: 0,
          background: av.bg, color: av.color,
        }}>
          {av.label}
        </div>

        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
          {card.label}
        </span>

        <span style={{
          fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
          background: chip.bg, color: chip.color,
        }}>
          {chip.label}
        </span>

        <span style={{
          fontSize: 10, color: 'var(--text3)', marginLeft: 'auto',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {card.timestamp}
        </span>

        {/* Explainer toggle */}
        <button
          onClick={() => setShowExplainer((v) => !v)}
          title="Why did the agent do this?"
          style={{
            marginLeft: 6, flexShrink: 0,
            fontSize: 10, padding: '2px 7px', borderRadius: 4,
            cursor: 'pointer', fontWeight: 600,
            border: `1px solid ${showExplainer ? 'var(--accent)' : 'var(--border2)'}`,
            background: showExplainer ? 'rgba(91,127,255,.1)' : 'transparent',
            color: showExplainer ? 'var(--accent)' : 'var(--text3)',
            transition: 'all .15s',
          }}
        >
          {showExplainer ? '▲ Why?' : '💡 Why?'}
        </button>
      </div>

      {/* Explainer panel */}
      {showExplainer && (
        <div style={{
          padding: '10px 13px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(91,127,255,.04)',
          animation: 'fadeIn .15s ease',
        }}>
          <div style={{
            fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.6px', color: 'var(--accent)', marginBottom: 8,
          }}>
            What is this node doing?
          </div>

          {[
            { icon: '🔍', label: 'What',    text: explain.what },
            { icon: '🤔', label: 'Why',     text: explain.why  },
            { icon: '➡️', label: 'What next', text: explain.next },
          ].map((row) => (
            <div key={row.label} style={{
              display: 'flex', gap: 8, marginBottom: 7,
            }}>
              <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{row.icon}</span>
              <div>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--text3)',
                  textTransform: 'uppercase', letterSpacing: '.5px',
                  marginRight: 5,
                }}>
                  {row.label}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                  {row.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div
        style={{ padding: '11px 13px', fontSize: 12, lineHeight: 1.65, color: 'var(--text2)' }}
        dangerouslySetInnerHTML={{ __html: card.body }}
      />
    </div>
  )
}