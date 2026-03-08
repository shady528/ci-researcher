'use client'
import { useEffect, useState } from 'react'
import { useAgentStore } from '@/store/agentStore'

interface ReportFull {
  id:           number
  topic:        string
  report_html:  string
  cred_label:   string
  source_count: number
  elapsed:      string
  created_at:   string
}

// Strip HTML tags to get plain text for diffing
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Split text into sentences for comparison
function toSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
}

// Simple diff — classify each sentence as added, removed, or same
type DiffLine = { text: string; status: 'same' | 'added' | 'removed' | 'changed' }

function diffSentences(oldSents: string[], newSents: string[]): DiffLine[] {
  const oldSet = new Set(oldSents)
  const newSet = new Set(newSents)
  const result: DiffLine[] = []

  // Sentences only in old = removed
  for (const s of oldSents) {
    if (!newSet.has(s)) result.push({ text: s, status: 'removed' })
  }
  // Sentences only in new = added
  for (const s of newSents) {
    if (!oldSet.has(s)) result.push({ text: s, status: 'added' })
  }
  // Sentences in both = same
  for (const s of newSents) {
    if (oldSet.has(s)) result.push({ text: s, status: 'same' })
  }

  return result
}

function credColor(label: string) {
  return label === 'Strong' ? 'var(--green)' : label === 'Moderate' ? 'var(--yellow)' : 'var(--red)'
}

export default function DiffView() {
  const { diffReportIds, setDiffMode, setDiffReportIds } = useAgentStore()
  const [reports, setReports] = useState<[ReportFull, ReportFull] | null>(null)
  const [loading, setLoading] = useState(true)
  const [view,    setView]    = useState<'diff' | 'side'>('diff')

  useEffect(() => {
    if (!diffReportIds) return
    const [idA, idB] = diffReportIds
    Promise.all([
      fetch(`/api/reports/${idA}`).then((r) => r.json()),
      fetch(`/api/reports/${idB}`).then((r) => r.json()),
    ]).then(([a, b]) => {
      setReports([a, b])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [diffReportIds])

  function close() {
    setDiffMode(false)
    setDiffReportIds(null)
  }

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 200, color: 'var(--text3)', fontSize: 13,
    }}>
      Loading reports for comparison…
    </div>
  )

  if (!reports) return null

  const [a, b] = reports
  const sentA  = toSentences(stripHtml(a.report_html))
  const sentB  = toSentences(stripHtml(b.report_html))
  const diff   = diffSentences(sentA, sentB)

  const added   = diff.filter((d) => d.status === 'added').length
  const removed = diff.filter((d) => d.status === 'removed').length
  const same    = diff.filter((d) => d.status === 'same').length

  const dateA = new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const dateB = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20,
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.7px', color: 'var(--text3)', marginBottom: 4,
          }}>
            Report Comparison
          </div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            {a.topic.length > 60 ? a.topic.slice(0, 60) + '…' : a.topic}
          </h2>
        </div>
        <button
          onClick={close}
          style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            color: 'var(--text2)', cursor: 'pointer',
          }}
        >
          ✕ Close
        </button>
      </div>

      {/* Report meta cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {[a, b].map((r, i) => (
          <div key={r.id} style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--surface2)',
            border: `1px solid ${i === 0 ? 'rgba(91,127,255,.3)' : 'rgba(31,207,114,.3)'}`,
          }}>
            <div style={{
              fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.6px', marginBottom: 5,
              color: i === 0 ? 'var(--accent)' : 'var(--green)',
            }}>
              {i === 0 ? '◀ Older' : '▶ Newer'} · {i === 0 ? dateA : dateB}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{
                fontSize: 10, fontWeight: 700,
                color: credColor(r.cred_label),
              }}>
                {r.cred_label}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>·</span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>
                {r.source_count} sources
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>·</span>
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{r.elapsed}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Diff summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '8px 14px', borderRadius: 8, marginBottom: 14,
        background: 'var(--bg)', border: '1px solid var(--border2)',
      }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>Changes:</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--green)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          +{added} <span style={{ fontWeight: 400, fontSize: 10 }}>added</span>
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          −{removed} <span style={{ fontWeight: 400, fontSize: 10 }}>removed</span>
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text3)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {same} <span style={{ fontWeight: 400, fontSize: 10 }}>unchanged</span>
        </span>

        {/* View toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {(['diff', 'side'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                padding: '3px 9px', borderRadius: 5, fontSize: 10,
                fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${view === v ? 'var(--accent)' : 'var(--border2)'}`,
                background: view === v ? 'rgba(91,127,255,.1)' : 'transparent',
                color: view === v ? 'var(--accent)' : 'var(--text3)',
                transition: 'all .15s',
              }}
            >
              {v === 'diff' ? '⇄ Diff' : '▥ Side by side'}
            </button>
          ))}
        </div>
      </div>

      {/* Diff view */}
      {view === 'diff' && (
        <div style={{
          borderRadius: 8, border: '1px solid var(--border2)',
          overflow: 'hidden',
        }}>
          {diff.filter((d) => d.status !== 'same').length === 0 ? (
            <div style={{
              padding: 24, textAlign: 'center',
              fontSize: 12, color: 'var(--text3)',
            }}>
              ✓ No differences found between these two reports.
            </div>
          ) : (
            diff.map((line, i) => {
              if (line.status === 'same') return null
              const bg    = line.status === 'added'   ? 'rgba(31,207,114,.06)'
                          : line.status === 'removed' ? 'rgba(255,79,79,.06)'
                          : 'rgba(240,192,64,.06)'
              const bar   = line.status === 'added'   ? 'var(--green)'
                          : line.status === 'removed' ? 'var(--red)'
                          : 'var(--yellow)'
              const prefix = line.status === 'added' ? '+' : '−'

              return (
                <div key={i} style={{
                  display: 'flex', gap: 0,
                  borderBottom: '1px solid var(--border)',
                  background: bg,
                }}>
                  <div style={{
                    width: 4, flexShrink: 0, background: bar,
                  }} />
                  <div style={{
                    width: 24, flexShrink: 0, padding: '7px 0',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: bar,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {prefix}
                  </div>
                  <div style={{
                    padding: '7px 12px 7px 4px',
                    fontSize: 11, color: 'var(--text2)', lineHeight: 1.6,
                  }}>
                    {line.text}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Side by side view */}
      {view === 'side' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { report: a, label: 'Older', color: 'var(--accent)', borderColor: 'rgba(91,127,255,.2)' },
            { report: b, label: 'Newer', color: 'var(--green)',  borderColor: 'rgba(31,207,114,.2)' },
          ].map(({ report, label, color, borderColor }) => (
            <div key={report.id} style={{
              borderRadius: 8, border: `1px solid ${borderColor}`,
              overflow: 'hidden',
            }}>
              <div style={{
                padding: '6px 12px',
                borderBottom: `1px solid ${borderColor}`,
                background: `${color}08`,
                fontSize: 9, fontWeight: 700, color,
                textTransform: 'uppercase', letterSpacing: '.6px',
              }}>
                {label}
              </div>
              <div
                style={{
                  padding: '12px 14px', fontSize: 11,
                  lineHeight: 1.7, color: 'var(--text2)',
                  maxHeight: 500, overflowY: 'auto',
                }}
                dangerouslySetInnerHTML={{ __html: report.report_html }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}