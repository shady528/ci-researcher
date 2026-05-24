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

const VISIBLE_LIMIT = 5

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
  const [reports,   setReports]   = useState<ReportRow[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [showAll,   setShowAll]   = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [tagInput,  setTagInput]  = useState('')

  const { setTopic, setReportMd, setAvgCred } = useAgentStore()
  const phase = useAgentStore((s) => s.phase)

  const fetchReports = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    // Always fetch all matching — we slice in the render
    try {
      const data = await fetch(`/api/reports?${params}`).then((r) => r.json())
      if (Array.isArray(data)) {
        setReports(data)
        setTotal(data.length)
      }
    } catch {}
  }, [search])

  useEffect(() => {
    fetchReports().finally(() => setLoading(false))
  }, [fetchReports])

  useEffect(() => {
    if (phase === 'idle') fetchReports()
  }, [phase, fetchReports])

  useEffect(() => {
    const t = setTimeout(() => fetchReports(), 200)
    return () => clearTimeout(t)
  }, [search, fetchReports])

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
  }

  async function removeTag(id: number, currentTags: string[], tag: string) {
    const updated = currentTags.filter((t) => t !== tag)
    await fetch(`/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: updated }),
    })
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, tags: updated } : r))
  }

  if (loading) return (
    <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '12px 0' }}>
      Loading history…
    </div>
  )

  if (total === 0 && !search) return null

  const visible = showAll ? reports : reports.slice(0, VISIBLE_LIMIT)
  const hidden  = total - VISIBLE_LIMIT

  return (
    <div>
      {/* Header */}
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
            {total}
          </span>
        </div>
      </div>

      {/* Search */}
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
          placeholder="Search all reports…"
          style={{
            width: '100%', background: 'var(--surface2)',
            border: '1px solid var(--border2)', borderRadius: 7,
            color: 'var(--text)', fontFamily: 'Inter, sans-serif',
            fontSize: 11, padding: '6px 10px 6px 28px', outline: 'none',
            transition: 'border-color .15s', boxSizing: 'border-box',
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

      {/* List */}
      {visible.length === 0 ? (
        <div style={{
          fontSize: 11, color: 'var(--text3)', textAlign: 'center',
          padding: '16px 0', fontStyle: 'italic',
        }}>
          No reports match your search.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {visible.map((r) => {
            const credColor = r.cred_label === 'Strong'   ? 'var(--green)'
                            : r.cred_label === 'Moderate' ? 'var(--yellow)'
                            : 'var(--red)'
            const date      = new Date(r.created_at).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric',
            })
            const isEditing = editingId === r.id

            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--surface2)',
                  border: '1px solid var(--border2)',
                  borderRadius: 8, overflow: 'hidden', transition: 'border-color .15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border2)'}
              >
                {/* Main row */}
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
                      <span key={tag} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 7px', borderRadius: 20, fontSize: 9,
                        fontWeight: 600, background: col.bg,
                        border: `1px solid ${col.border}`, color: col.text,
                      }}>
                        {tag}
                        <button
                          onClick={(e) => { e.stopPropagation(); removeTag(r.id, r.tags, tag) }}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: col.text, fontSize: 10, padding: 0,
                            opacity: 0.7, lineHeight: 1,
                          }}
                        >✕</button>
                      </span>
                    )
                  })}

                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 3 }}>
                      <input
                        autoFocus
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')  addTag(r.id, r.tags, tagInput)
                          if (e.key === 'Escape') { setEditingId(null); setTagInput('') }
                        }}
                        placeholder="tag…"
                        style={{
                          width: 72, fontSize: 9, padding: '2px 6px',
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
                        background: 'none', border: '1px dashed var(--border2)',
                        color: 'var(--text3)', cursor: 'pointer', transition: 'all .15s',
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

      {/* Show all / collapse toggle */}
      {!search && total > VISIBLE_LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            marginTop: 8, width: '100%', padding: '6px 0',
            background: 'none', border: '1px dashed var(--border2)',
            borderRadius: 7, cursor: 'pointer',
            fontSize: 10, color: 'var(--text3)', fontWeight: 600,
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
          {showAll ? '▲ Show less' : `▼ Show ${hidden} more`}
        </button>
      )}
    </div>
  )
}