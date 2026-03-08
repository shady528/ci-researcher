'use client'
import { useState } from 'react'
import { useAgentStore } from '@/store/agentStore'
import type { ScoredDoc, SourceType } from '@/types/agent'

const TYPE_META: Record<SourceType, { label: string; color: string; bg: string; trust: string }> = {
  official:     { label:'Official',     color:'var(--green)',  bg:'rgba(31,207,114,.1)',  trust:'Highly trusted — official domain or government source'         },
  internal_doc: { label:'Internal Doc', color:'var(--purple)', bg:'rgba(157,127,240,.1)', trust:'Fully trusted — your own uploaded document'                    },
  review_site:  { label:'Review Site',  color:'var(--accent)', bg:'rgba(91,127,255,.1)',  trust:'Moderately trusted — aggregated user reviews, may be biased'   },
  reddit:       { label:'Reddit',       color:'var(--red)',    bg:'rgba(255,79,79,.08)',  trust:'Low trust — community content, unverified, high noise'          },
  blog:         { label:'Blog',         color:'var(--text2)',  bg:'rgba(110,125,154,.1)', trust:'Variable trust — depends on author authority and recency'       },
  news:         { label:'News',         color:'var(--cyan)',   bg:'rgba(23,204,224,.1)',  trust:'Moderately trusted — journalistic sources, verify date'         },
  community:    { label:'Community',    color:'var(--yellow)', bg:'rgba(240,192,64,.1)',  trust:'Low-moderate trust — community opinions, useful for sentiment'  },
}

function credExplain(score: number): string {
  if (score >= 0.9) return 'Excellent — authoritative, recent, and highly reliable'
  if (score >= 0.75) return 'Strong — reliable source with good recency'
  if (score >= 0.5) return 'Moderate — usable but treat with some caution'
  if (score >= 0.3) return 'Weak — low authority or outdated, use only to fill gaps'
  return 'Poor — unreliable, excluded from core analysis'
}

function CredBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{
      height: 4, background: 'var(--border2)', borderRadius: 2,
      overflow: 'hidden', width: '100%', marginTop: 3,
    }}>
      <div style={{
        height: '100%', borderRadius: 2, background: color,
        width: `${value * 100}%`, transition: 'width .6s ease',
      }} />
    </div>
  )
}

function SourcePreview({ doc, meta, barCol }: {
  doc: ScoredDoc
  meta: typeof TYPE_META[SourceType]
  barCol: string
}) {
  // Extract domain from URL for display
  const domain = doc.url.replace(/^https?:\/\//, '').split('/')[0]
  const isInternal = doc.type === 'internal_doc'

  return (
    <div style={{
      position: 'absolute', left: '105%', top: '50%',
      transform: 'translateY(-50%)',
      width: 220, zIndex: 50,
      background: 'var(--surface)',
      border: '1px solid var(--border2)',
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,.35)',
      padding: '10px 12px',
      animation: 'fadeIn .1s ease',
      pointerEvents: 'none',
    }}>
      {/* Domain header */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: 'var(--text)',
        marginBottom: 4, overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {isInternal ? '📄 ' : '🌐 '}{domain}
      </div>

      {/* Type badge */}
      <span style={{
        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
        background: meta.bg, color: meta.color, marginBottom: 8,
        display: 'inline-block',
      }}>
        {meta.label}
      </span>

      <div style={{ height: 1, background: 'var(--border)', margin: '7px 0' }} />

      {/* Score */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 3,
      }}>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>Credibility</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: barCol,
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {doc.credibility.toFixed(2)}
        </span>
      </div>
      <CredBar value={doc.credibility} color={barCol} />

      {/* Recency */}
      {doc.recency !== undefined && (
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginTop: 5, marginBottom: 3,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text3)' }}>Recency</span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text2)',
            fontFamily: 'JetBrains Mono, monospace',
          }}>
            {doc.recency.toFixed(2)}
          </span>
        </div>
      )}

      <div style={{ height: 1, background: 'var(--border)', margin: '7px 0' }} />

      {/* Plain English explanation */}
      <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 5 }}>
        {credExplain(doc.credibility)}
      </div>

      {/* Trust note */}
      <div style={{
        fontSize: 9, color: 'var(--text3)', lineHeight: 1.4,
        fontStyle: 'italic', borderTop: '1px solid var(--border)', paddingTop: 6,
      }}>
        {meta.trust}
      </div>
    </div>
  )
}

function DocRow({ doc }: { doc: ScoredDoc }) {
  const [hovered, setHovered] = useState(false)
  const meta   = TYPE_META[doc.type as SourceType] ?? TYPE_META.blog
  const barCol = doc.credibility >= 0.7 ? 'var(--green)'
               : doc.credibility >= 0.4 ? 'var(--yellow)'
               : 'var(--red)'

  return (
    <div
      style={{
        position: 'relative',
        padding: '5px 8px', borderRadius: 5,
        background: hovered ? 'var(--surface)' : 'var(--surface2)',
        border: `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        marginBottom: 3, transition: 'all .15s', cursor: 'default',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 2,
      }}>
        <span style={{
          fontSize: 10, color: 'var(--text2)', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '72%',
          fontFamily: 'JetBrains Mono, monospace',
        }}>
          {doc.url}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: barCol,
          fontFamily: 'JetBrains Mono, monospace', flexShrink: 0, marginLeft: 8,
        }}>
          {doc.credibility.toFixed(2)}
        </span>
      </div>
      <CredBar value={doc.credibility} color={barCol} />

      {hovered && (
        <SourcePreview doc={doc} meta={meta} barCol={barCol} />
      )}
    </div>
  )
}

function groupByType(docs: ScoredDoc[]) {
  const groups: Record<string, ScoredDoc[]> = {}
  for (const d of docs) {
    if (!groups[d.type]) groups[d.type] = []
    groups[d.type].push(d)
  }
  return groups
}

export default function CredibilityPanel() {
  const docs    = useAgentStore((s) => s.scoredDocs)
  const avgCred = useAgentStore((s) => s.avgCred)

  if (docs.length === 0) {
    return (
      <div style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
        <div style={{ fontSize: 24, marginBottom: 8, opacity: .3 }}>🛡</div>
        Credibility scores appear after the Validator runs.
      </div>
    )
  }

  const credNum   = parseFloat(avgCred)
  const credColor = credNum >= 0.75 ? 'var(--green)' : credNum >= 0.5 ? 'var(--yellow)' : 'var(--red)'
  const credLabel = credNum >= 0.75 ? 'High Confidence' : credNum >= 0.5 ? 'Moderate' : 'Low'
  const groups    = groupByType(docs)

  return (
    <div>
      {/* Overall score */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 13,
        padding: '10px 13px', borderRadius: 8,
        background: 'var(--bg)', border: '1px solid var(--border2)',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 26, fontWeight: 700, color: credColor,
          fontFamily: 'JetBrains Mono, monospace', lineHeight: 1,
        }}>
          {avgCred}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: credColor }}>{credLabel}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
            {docs.length} sources scored · hover any source for details
          </div>
          <CredBar value={credNum} color={credColor} />
        </div>
      </div>

      {/* Groups */}
      {Object.entries(groups).map(([type, typeDocs]) => {
        const meta = TYPE_META[type as SourceType] ?? TYPE_META.blog
        const avgT = typeDocs.reduce((a, d) => a + d.credibility, 0) / typeDocs.length

        return (
          <div key={type} style={{ marginBottom: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 5,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                background: meta.bg, color: meta.color,
              }}>
                {meta.label}
              </span>
              <span style={{
                fontSize: 10, color: 'var(--text3)',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                avg {avgT.toFixed(2)} · {typeDocs.length} doc{typeDocs.length > 1 ? 's' : ''}
              </span>
            </div>

            {typeDocs.map((d, i) => (
              <DocRow key={i} doc={d} />
            ))}
          </div>
        )
      })}
    </div>
  )
}