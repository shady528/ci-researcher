'use client'
import { useState, useCallback, useEffect } from 'react'
import { useAgentStore } from '@/store/agentStore'

interface ReportRow {
  id:           number
  topic:        string
  cred_label:   string
  source_count: number
  elapsed:      string
  tags:         string[]
  created_at:   string
}

interface Stats {
  total_runs:     number
  avg_sources:    number
  strong_count:   number
  moderate_count: number
  limited_count:  number
  top_topic:      string | null
  all_tags:       string[] | null
}

const TAG_COLORS = [
  { bg: 'rgba(91,127,255,.12)',  border: 'rgba(91,127,255,.3)',  text: 'var(--accent)'  },
  { bg: 'rgba(31,207,114,.1)',   border: 'rgba(31,207,114,.3)',  text: 'var(--green)'   },
  { bg: 'rgba(157,127,240,.12)', border: 'rgba(157,127,240,.3)', text: 'var(--purple)'  },
  { bg: 'rgba(240,192,64,.1)',   border: 'rgba(240,192,64,.3)',  text: 'var(--yellow)'  },
  { bg: 'rgba(23,204,224,.1)',   border: 'rgba(23,204,224,.3)',  text: 'var(--cyan)'    },
]

function tagColor(tag: string) {
  let hash = 0
  for (const c of tag) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff
  return TAG_COLORS[hash % TAG_COLORS.length]
}

export default function RecentReports() {
  const [reports,     setReports]     = useState<ReportRow[]>([])
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [activeTag,   setActiveTag]   = useState('')
  const [showStats,   setShowStats]   = useState(false)
  const [editingId,   setEditingId]   = useState<number | null>(null)
  const [tagInput,    setTagInput]    = useState('')
  const [compareMode,    setCompareMode]    = useState(false)
const [compareIds,     setCompareIds]     = useState<number[]>([])
const { setDiffMode, setDiffReportIds }   = useAgentStore()

const { setTopic, setReportMd, setAvgCred } = useAgentStore()
const phase = useAgentStore((s) => s.phase)

  const fetchReports = useCallback(async () => {
    const params = new URLSearchParams()
    if (search)    params.set('search', search)
    if (activeTag) params.set('tag', activeTag)
    try {
      const data = await fetch(`/api/reports?${params}`).then((r) => r.json())
      if (Array.isArray(data)) setReports(data)
    } catch {}
  }, [search, activeTag])

  const fetchStats = useCallback(async () => {
    try {
      const data = await fetch('/api/stats').then((r) => r.json())
      if (data?.total_runs !== undefined) setStats(data)
    } catch {}
  }, [])


useEffect(() => {
  Promise.all([fetchReports(), fetchStats()]).finally(() => setLoading(false))
}, [fetchReports, fetchStats])

// Re-fetch whenever the agent returns to idle (after reset or completion)
useEffect(() => {
  if (phase === 'idle') {
    fetchReports()
    fetchStats()
  }
}, [phase, fetchReports, fetchStats])

  // Re-fetch when search/tag changes (debounced for search)
  useEffect(() => {
    const t = setTimeout(() => fetchReports(), 200)
    return () => clearTimeout(t)
  }, [search, activeTag, fetchReports])

  async function loadReport(id: number) {
    try {
      const data = await fetch(`/api/reports/${id}`).then((r) => r.json())
      setTopic(data.topic)
      setReportMd(data.report_html)
      const credMap: Record<string, string> = {
        Strong: '0.85', Moderate: '0.62', Limited: '0.35',
      }
      setAvgCred(credMap[data.cred_label] ?? '0.85')
    } catch (err) {
      console.error('Failed to load report', err)
    }
  }

  async function addTag(id: number, currentTags: string[], newTag: string) {
    const tag = newTag.trim().toLowerCase()
    if (!tag || currentTags.includes(tag)) return
    const updated = [...currentTags, tag]
    await fetch(`/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updated }),
    })
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, tags: updated } : r))
    setTagInput('')
    fetchStats()
  }

  async function removeTag(id: number, currentTags: string[], tag: string) {
    const updated = currentTags.filter((t) => t !== tag)
    await fetch(`/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updated }),
    })
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, tags: updated } : r))
    fetchStats()
  }

  if (loading) return (
    <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
      Loading history…
    </div>
  )

  if (!stats || stats.total_runs === 0) return null

  const allTags = stats.all_tags ?? []

  return (
    <div style={{ marginTop: 32 }}>

      {/* Header row */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.7px', color: 'var(--text3)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          Recent Reports
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 10,
            background: 'var(--surface2)', border: '1px solid var(--border2)',
            color: 'var(--text3)', fontWeight: 600,
          }}>
            {stats.total_runs}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {compareMode ? (
            <>
              <span style={{ fontSize: 9, color: 'var(--text3)' }}>
                {compareIds.length}/2 selected
              </span>
              {compareIds.length === 2 && (
                <button
                  onClick={() => {
                    setDiffReportIds([compareIds[0], compareIds[1]] as [number, number])
                    setDiffMode(true)
                    setCompareMode(false)
                    setCompareIds([])
                  }}
                  style={{
                    fontSize: 9, padding: '2px 8px', borderRadius: 4,
                    background: 'var(--accent)', border: 'none',
                    color: '#fff', cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  Compare ↗
                </button>
              )}
              <button
                onClick={() => { setCompareMode(false); setCompareIds([]) }}
                style={{
                  fontSize: 9, padding: '2px 7px', borderRadius: 4,
                  background: 'none', border: '1px solid var(--border2)',
                  color: 'var(--text3)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setCompareMode(true)}
                style={{
                  fontSize: 10, color: 'var(--text3)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: 600, padding: 0,
                }}
              >
                ⇄ Compare
              </button>
              <button
                onClick={() => setShowStats((v) => !v)}
                style={{
                  fontSize: 10, color: showStats ? 'var(--accent)' : 'var(--text3)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontWeight: 600, padding: 0,
                }}
              >
                {showStats ? '▲ Hide stats' : '📊 Stats'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Usage stats panel */}
      {showStats && stats && (
        <div style={{
          marginBottom: 12, padding: '10px 12px', borderRadius: 8,
          background: 'var(--surface2)', border: '1px solid var(--border2)',
          animation: 'fadeIn .15s ease',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
            marginBottom: 10,
          }}>
            {[
              { label: 'Total Runs',    value: String(stats.total_runs)  },
              { label: 'Avg Sources',   value: String(stats.avg_sources) },
              { label: 'Strong Quality',value: `${stats.strong_count}/${stats.total_runs}` },
            ].map((s) => (
              <div key={s.label} style={{
                padding: '7px 9px', borderRadius: 6,
                background: 'var(--bg)', border: '1px solid var(--border)',
                textAlign: 'center',
              }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: 'var(--accent)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          {/* Quality breakdown bar */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>
              Source quality breakdown
            </div>
            <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
              {stats.total_runs > 0 && <>
                <div style={{ flex: stats.strong_count,   background: 'var(--green)',  borderRadius: '3px 0 0 3px' }} />
                <div style={{ flex: stats.moderate_count, background: 'var(--yellow)' }} />
                <div style={{ flex: stats.limited_count,  background: 'var(--red)',   borderRadius: '0 3px 3px 0' }} />
              </>}
            </div>
            <div style={{
              display: 'flex', gap: 10, marginTop: 4, fontSize: 9, color: 'var(--text3)',
            }}>
              <span style={{ color: 'var(--green)'  }}>● Strong {stats.strong_count}</span>
              <span style={{ color: 'var(--yellow)' }}>● Moderate {stats.moderate_count}</span>
              <span style={{ color: 'var(--red)'    }}>● Limited {stats.limited_count}</span>
            </div>
          </div>

          {stats.top_topic && (
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>
              Most researched:{' '}
              <span style={{ color: 'var(--text2)', fontWeight: 600 }}>
                {stats.top_topic.length > 50
                  ? stats.top_topic.slice(0, 50) + '…'
                  : stats.top_topic}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Search box */}
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <span style={{
          position: 'absolute', left: 9, top: '50%',
          transform: 'translateY(-50%)', fontSize: 11,
          color: 'var(--text3)', pointerEvents: 'none',
        }}>🔍</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reports…"
          style={{
            width: '100%', background: 'var(--surface2)',
            border: '1px solid var(--border2)', borderRadius: 7,
            color: 'var(--text)', fontFamily: 'Inter, sans-serif',
            fontSize: 11, padding: '6px 10px 6px 28px', outline: 'none',
            transition: 'border-color .15s',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
          onBlur={(e)  => e.target.style.borderColor = 'var(--border2)'}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute', right: 8, top: '50%',
              transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--text3)', padding: 0,
            }}
          >✕</button>
        )}
      </div>

      {/* Tag filter pills */}
      {allTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {allTags.map((tag) => {
            const col    = tagColor(tag)
            const active = activeTag === tag
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(active ? '' : tag)}
                style={{
                  padding: '2px 8px', borderRadius: 20, fontSize: 10,
                  fontWeight: 600, cursor: 'pointer',
                  background: active ? col.bg  : 'transparent',
                  border:     `1px solid ${active ? col.border : 'var(--border2)'}`,
                  color:      active ? col.text : 'var(--text3)',
                  transition: 'all .15s',
                }}
              >
                {tag}
              </button>
            )
          })}
          {activeTag && (
            <button
              onClick={() => setActiveTag('')}
              style={{
                padding: '2px 8px', borderRadius: 20, fontSize: 10,
                fontWeight: 600, cursor: 'pointer',
                background: 'none', border: '1px solid var(--border2)',
                color: 'var(--text3)',
              }}
            >
              ✕ clear
            </button>
          )}
        </div>
      )}

      {/* Report list */}
      {reports.length === 0 ? (
        <div style={{
          fontSize: 11, color: 'var(--text3)', textAlign: 'center',
          padding: '16px 0', fontStyle: 'italic',
        }}>
          No reports match your search.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {reports.map((r) => {
            const credColor = r.cred_label === 'Strong'   ? 'var(--green)'
                            : r.cred_label === 'Moderate' ? 'var(--yellow)'
                            : 'var(--red)'
            const date = new Date(r.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })
            const isEditing = editingId === r.id
            const isSelected = compareIds.includes(r.id)
            const isDisabled = compareMode && compareIds.length === 2 && !isSelected

            return (
              <div
                key={r.id}
                onClick={() => {
                  if (!compareMode) return
                  if (isSelected) {
                    setCompareIds(compareIds.filter((i) => i !== r.id))
                  } else if (compareIds.length < 2) {
                    setCompareIds([...compareIds, r.id])
                  }
                }}
                style={{
                  background: isSelected ? 'rgba(91,127,255,.06)' : 'var(--surface2)',
                  border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border2)'}`,
                  borderRadius: 8, overflow: 'hidden',
                  transition: 'all .15s',
                  opacity: isDisabled ? 0.4 : 1,
                  cursor: compareMode ? 'pointer' : 'default',
                }}
                onMouseEnter={(e) => {
                  if (!compareMode) e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.borderColor = 'var(--border2)'
                }}
              >
                {/* Compare selection indicator */}
                {compareMode && (
                  <div style={{
                    padding: '4px 12px',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'rgba(91,127,255,.08)' : 'transparent',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontSize: 9, color: isSelected ? 'var(--accent)' : 'var(--text3)',
                    fontWeight: 700,
                  }}>
                    <div style={{
                      width: 12, height: 12, borderRadius: 3,
                      border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border2)'}`,
                      background: isSelected ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 8, color: '#fff', flexShrink: 0,
                    }}>
                      {isSelected ? '✓' : ''}
                    </div>
                    {isSelected
                      ? `Report ${compareIds.indexOf(r.id) + 1} of 2`
                      : 'Click to select for comparison'}
                  </div>
                )}
                {/* Main row — clickable to load */}
                <button
                  onClick={() => loadReport(r.id)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '9px 12px 6px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    marginBottom: 4, lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.topic}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ fontSize: 9, color: credColor, fontWeight: 700 }}>
                      {r.cred_label}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text3)' }}>·</span>
                    <span style={{ fontSize: 9, color: 'var(--text3)' }}>
                      {r.source_count} sources
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--text3)' }}>·</span>
                    <span style={{ fontSize: 9, color: 'var(--text3)' }}>{date}</span>
                  </div>
                </button>

                {/* Tags row */}
                <div style={{
                  padding: '4px 12px 8px',
                  display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4,
                }}>
                  {r.tags.map((tag) => {
                    const col = tagColor(tag)
                    return (
                      <span
                        key={tag}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                          padding: '1px 7px', borderRadius: 20, fontSize: 9,
                          fontWeight: 600, background: col.bg,
                          border: `1px solid ${col.border}`, color: col.text,
                        }}
                      >
                        {tag}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeTag(r.id, r.tags, tag) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: col.text, fontSize: 10, padding: 0, opacity: 0.7,
                            lineHeight: 1,
                          }}
                        >✕</button>
                      </span>
                    )
                  })}

                  {/* Add tag button */}
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 3 }}>
                      <input
                        autoFocus
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTag(r.id, r.tags, tagInput)
                          if (e.key === 'Escape') { setEditingId(null); setTagInput('') }
                        }}
                        placeholder="tag name…"
                        style={{
                          width: 80, fontSize: 9, padding: '2px 6px',
                          borderRadius: 4, border: '1px solid var(--accent)',
                          background: 'var(--bg)', color: 'var(--text)',
                          outline: 'none', fontFamily: 'Inter, sans-serif',
                        }}
                      />
                      <button
                        onClick={() => addTag(r.id, r.tags, tagInput)}
                        style={{
                          fontSize: 10, padding: '2px 6px', borderRadius: 4,
                          background: 'rgba(91,127,255,.15)',
                          border: '1px solid var(--accent)',
                          color: 'var(--accent)', cursor: 'pointer', fontWeight: 700,
                        }}
                      >+</button>
                      <button
                        onClick={() => { setEditingId(null); setTagInput('') }}
                        style={{
                          fontSize: 10, padding: '2px 5px', borderRadius: 4,
                          background: 'none', border: '1px solid var(--border2)',
                          color: 'var(--text3)', cursor: 'pointer',
                        }}
                      >✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingId(r.id); setTagInput('') }}
                      style={{
                        fontSize: 9, padding: '1px 7px', borderRadius: 20,
                        background: 'none',
                        border: '1px dashed var(--border2)',
                        color: 'var(--text3)', cursor: 'pointer',
                        transition: 'all .15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--accent)'
                        e.currentTarget.style.color = 'var(--accent)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--border2)'
                        e.currentTarget.style.color = 'var(--text3)'
                      }}
                    >
                      + tag
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
