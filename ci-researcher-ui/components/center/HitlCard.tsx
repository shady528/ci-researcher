'use client'
import { useRef, useState } from 'react'
import { useAgentStore }  from '@/store/agentStore'
import { useAgentStream } from '@/hooks/useAgentStream'

export default function HitlCard() {
  const hitlData = useAgentStore((s) => s.hitlData)
  const { approve } = useAgentStream()
  const [approved,  setApproved]  = useState(false)
  const [editing,   setEditing]   = useState(false)
  const editRefs = useRef<Record<number, string>>({})

  if (!hitlData) return null

  const webQ = hitlData.webQueries
  const ragQ = hitlData.internalQueries
  const all  = [...webQ, ...ragQ]

  async function handleApprove() {
    // Collect any edits from the input refs
    const finalWeb = webQ.map((q, i) => editRefs.current[i] ?? q)
    const finalRag = ragQ.map((q, i) => editRefs.current[webQ.length + i] ?? q)
    setApproved(true)
    await approve(finalWeb, finalRag)
  }

  if (approved) {
    return (
      <div className="fade-in" style={{
        borderRadius: 9, border: '1px solid rgba(31,207,114,.3)',
        background: 'var(--surface2)', padding: 13, marginBottom: 9,
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--green)' }}>
          ✅ Approved — Researcher now running…
        </div>
      </div>
    )
  }

  return (
    <div className="fade-in" style={{
      borderRadius: 9, border: '1px solid rgba(157,127,240,.3)',
      background: 'var(--surface2)', padding: 13, marginBottom: 9,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: 'var(--purple)',
        marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        ⏸ Human-in-the-Loop Checkpoint
      </div>

      <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.5 }}>
        Planner generated queries for{' '}
        <strong style={{ color: 'var(--text)' }}>
          {ragQ.length > 0 ? 'web + internal RAG' : 'web'}
        </strong>{' '}
        search. Review before spending API credits.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        {all.map((q, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'var(--bg)', border: '1px solid var(--border2)',
            borderRadius: 5, padding: '6px 9px',
            fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text2)',
          }}>
            <span style={{ fontSize: 9, color: 'var(--text3)', width: 12, textAlign: 'right', flexShrink: 0 }}>
              {i + 1}
            </span>
            {editing ? (
              <input
                defaultValue={q}
                onChange={(e) => { editRefs.current[i] = e.target.value }}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
                }}
              />
            ) : (
              <span style={{ flex: 1 }}>{q}</span>
            )}
            {i >= webQ.length && (
              <span style={{
                fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                background: 'rgba(157,127,240,.1)', color: 'var(--purple)', flexShrink: 0,
              }}>
                RAG
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 7 }}>
        <button
          onClick={handleApprove}
          style={{
            flex: 1, padding: 7, borderRadius: 6,
            background: 'rgba(31,207,114,.12)', color: 'var(--green)',
            border: '1px solid rgba(31,207,114,.25)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          ✓ Approve &amp; Run
        </button>
        <button
          onClick={() => setEditing((v) => !v)}
          style={{
            flex: 1, padding: 7, borderRadius: 6,
            background: 'var(--bg)', color: 'var(--text2)',
            border: '1px solid var(--border2)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {editing ? '💾 Save Edits' : '✎ Edit Queries'}
        </button>
      </div>
    </div>
  )
}