'use client'
import { useState, useRef, useEffect } from 'react'
import { useAgentStore } from '@/store/agentStore'
import UploadZone from '@/components/center/UploadZone'
import type { ReportTemplate } from '@/store/agentStore'

const SOURCE_MODES = [
  { id: 'web',      label: '🌐 Web'    },
  { id: 'internal', label: '📁 Docs'   },
  { id: 'hybrid',   label: '⚡ Hybrid' },
] as const

const DOMAIN_PRESETS = [
  { label: '🏛 Official only', allow: ['.gov', '.edu', '.org'], block: [] },
  { label: '📰 No social',     allow: [], block: ['reddit.com', 'twitter.com', 'x.com', 'facebook.com'] },
  { label: '🔬 Academic',      allow: ['.edu', 'arxiv.org', 'scholar.google.com'], block: [] },
  { label: '🧹 Clear all',     allow: [], block: [] },
]

const TEMPLATES: { id: ReportTemplate; icon: string; label: string; sub: string }[] = [
  { id: 'full',     icon: '📄', label: 'Full Analysis',      sub: 'Executive summary, matrix, trends, recommendations' },
  { id: 'briefing', icon: '⚡', label: 'Executive Briefing', sub: '1-page bullet summary, key findings only'            },
  { id: 'table',    icon: '📊', label: 'Comparison Table',   sub: 'Feature-by-feature table, minimal prose'            },
]

interface TopicInputProps {
  onRun: () => void
}

export default function TopicInput({ onRun }: TopicInputProps) {
  const topic          = useAgentStore((s) => s.topic)
  const setTopic       = useAgentStore((s) => s.setTopic)
  const focus          = useAgentStore((s) => s.focus)
  const setFocus       = useAgentStore((s) => s.setFocus)
  const sourceMode     = useAgentStore((s) => s.sourceMode)
  const setMode        = useAgentStore((s) => s.setSourceMode)
  const domainAllow    = useAgentStore((s) => s.domainAllow)
  const domainBlock    = useAgentStore((s) => s.domainBlock)
  const setDomainAllow = useAgentStore((s) => s.setDomainAllow)
  const setDomainBlock = useAgentStore((s) => s.setDomainBlock)
  const reportTemplate = useAgentStore((s) => s.reportTemplate)
  const setTemplate    = useAgentStore((s) => s.setReportTemplate)
  const phase          = useAgentStore((s) => s.phase)
  const busy           = phase === 'running' || phase === 'hitl'

  const [showDomains,   setShowDomains]   = useState(false)
  const [showUploadBox, setShowUploadBox] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [allowInput,    setAllowInput]    = useState('')
  const [blockInput,    setBlockInput]    = useState('')

  const containerRef    = useRef<HTMLDivElement>(null)
  const outputBtnRef    = useRef<HTMLButtonElement>(null)
  const [outputOrigin,  setOutputOrigin] = useState({ x: 0, y: 0 })

  const showUpload = sourceMode === 'internal' || sourceMode === 'hybrid'
  const hasFilters = domainAllow.length > 0 || domainBlock.length > 0 || focus.trim().length > 0
  const activeTemplate = TEMPLATES.find((t) => t.id === reportTemplate)!

  // Close all overlays on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDomains(false)
        setShowUploadBox(false)
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) onRun()
    if (e.key === 'Escape') { setShowDomains(false); setShowUploadBox(false); setShowTemplates(false) }
  }

  function openTemplates() {
    if (outputBtnRef.current) {
      const r = outputBtnRef.current.getBoundingClientRect()
      const p = containerRef.current!.getBoundingClientRect()
      setOutputOrigin({ x: r.left - p.left + r.width / 2, y: r.top - p.top })
    }
    setShowTemplates((v) => !v)
    setShowDomains(false)
    setShowUploadBox(false)
  }

  function pickTemplate(id: ReportTemplate) {
    setTemplate(id)
    setShowTemplates(false)
  }

  function addAllow(raw: string) {
    const val = raw.trim()
    if (!val || domainAllow.includes(val)) return
    setDomainAllow([...domainAllow, val])
    setAllowInput('')
  }

  function addBlock(raw: string) {
    const val = raw.trim()
    if (!val || domainBlock.includes(val)) return
    setDomainBlock([...domainBlock, val])
    setBlockInput('')
  }

  return (
    <div ref={containerRef} style={{ maxWidth: 720, margin: '0 auto', position: 'relative' }}>

      {/* ── Main card ── */}
      <div style={{
        border: '1px solid var(--border2)', borderRadius: 12,
        background: 'var(--bg)', overflow: 'visible',
        transition: 'border-color .2s, box-shadow .2s',
      }}
        onFocusCapture={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(91,127,255,.1)' }}
        onBlurCapture={(e)  => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.boxShadow = 'none' } }}
      >
        {/* Textarea */}
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="What do you want to research? e.g. Compare HubSpot vs Salesforce AI features in 2025…"
          disabled={busy}
          style={{
            width: '100%', background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text)', fontFamily: 'Inter, sans-serif',
            fontSize: 14, padding: '16px 18px 10px',
            resize: 'none', lineHeight: 1.6,
            opacity: busy ? 0.6 : 1, boxSizing: 'border-box',
          }}
        />

        {/* Focus */}
        <div style={{ padding: '6px 18px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: 'var(--text3)', pointerEvents: 'none', fontWeight: 600,
            }}>Focus:</span>
            <input
              type="text" value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={busy}
              placeholder="e.g. pricing only, enterprise features, compliance…"
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text)', fontFamily: 'Inter, sans-serif',
                fontSize: 12, padding: '5px 10px 5px 52px',
                opacity: busy ? 0.6 : 1, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface2)',
          borderRadius: '0 0 12px 12px',
          gap: 8,
        }}>
          {/* Left controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1 }}>

            {/* Source mode pills */}
            {SOURCE_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id)
                  if (m.id === 'internal' || m.id === 'hybrid') {
                    setShowUploadBox(true)
                    setShowDomains(false)
                    setShowTemplates(false)
                  } else {
                    setShowUploadBox(false)
                  }
                }}
                disabled={busy}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                  cursor: busy ? 'default' : 'pointer',
                  border: `1px solid ${sourceMode === m.id ? 'var(--accent)' : 'var(--border2)'}`,
                  background: sourceMode === m.id ? 'rgba(91,127,255,.12)' : 'transparent',
                  color: sourceMode === m.id ? 'var(--accent)' : 'var(--text3)',
                  transition: 'all .15s',
                }}
              >{m.label}</button>
            ))}

            {/* Divider */}
            <div style={{ width: 1, height: 16, background: 'var(--border2)', margin: '0 2px' }} />

            {/* Filters toggle */}
            <button
              onClick={() => { setShowDomains((v) => !v); setShowUploadBox(false); setShowTemplates(false) }}
              disabled={busy}
              style={{
                padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                border: `1px solid ${hasFilters ? 'var(--yellow)' : showDomains ? 'var(--accent)' : 'var(--border2)'}`,
                background: hasFilters ? 'rgba(240,192,64,.1)' : showDomains ? 'rgba(91,127,255,.1)' : 'transparent',
                color: hasFilters ? 'var(--yellow)' : showDomains ? 'var(--accent)' : 'var(--text3)',
                transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              🔒 Filters
              {hasFilters && (
                <span style={{
                  fontSize: 9, fontWeight: 700, background: 'var(--yellow)', color: '#000',
                  borderRadius: '50%', width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {domainAllow.length + domainBlock.length + (focus.trim() ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Output Options */}
            <button
              ref={outputBtnRef}
              onClick={openTemplates}
              disabled={busy}
              style={{
                padding: '4px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                border: `1px solid ${showTemplates ? 'var(--accent)' : 'var(--border2)'}`,
                background: showTemplates ? 'rgba(91,127,255,.12)' : 'transparent',
                color: showTemplates ? 'var(--accent)' : 'var(--text3)',
                transition: 'all .15s', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {activeTemplate.icon} Output Options
              <span style={{
                fontSize: 9, transition: 'transform .2s',
                transform: showTemplates ? 'rotate(180deg)' : 'rotate(0deg)',
                display: 'inline-block',
              }}>▾</span>
            </button>
          </div>

          {/* ── Run button — separated with a gap ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!busy && (
              <span style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap' }}>⌘↵</span>
            )}
            <button
              onClick={onRun}
              disabled={busy}
              style={{
                padding: '7px 20px', borderRadius: 8,
                background: busy
                  ? 'var(--border2)'
                  : 'linear-gradient(135deg, var(--accent2), var(--purple))',
                border: '2px solid transparent',
                outline: busy ? 'none' : '2px solid rgba(157,127,240,.25)',
                outlineOffset: 2,
                color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                transition: 'all .15s', letterSpacing: '.3px',
                whiteSpace: 'nowrap',
                boxShadow: busy ? 'none' : '0 2px 12px rgba(157,127,240,.35)',
              }}
              onMouseEnter={(e) => { if (!busy) e.currentTarget.style.boxShadow = '0 4px 20px rgba(157,127,240,.55)' }}
              onMouseLeave={(e) => { if (!busy) e.currentTarget.style.boxShadow = '0 2px 12px rgba(157,127,240,.35)' }}
            >
              {busy ? '⏳ Running…' : '▶ Run'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Template picker — expands from button origin ── */}
      <style>{`
        @keyframes expandFromPoint {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {showTemplates && !busy && (
        <div style={{
          position: 'absolute',
          // anchor near the Output Options button
          left: Math.min(outputOrigin.x - 100, 400),
          top: 'calc(100% - 48px)',
          zIndex: 50,
          width: 280,
          borderRadius: 10,
          border: '1px solid var(--border2)',
          background: 'var(--surface)',
          boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          overflow: 'hidden',
          transformOrigin: `${outputOrigin.x - Math.min(outputOrigin.x - 100, 400)}px top`,
          animation: 'expandFromPoint .18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <div style={{
            padding: '8px 12px 6px',
            fontSize: 9, fontWeight: 700, color: 'var(--text3)',
            textTransform: 'uppercase', letterSpacing: '.7px',
            borderBottom: '1px solid var(--border)',
          }}>
            Output Format
          </div>
          {TEMPLATES.map((t) => {
            const active = reportTemplate === t.id
            return (
              <button
                key={t.id}
                onClick={() => pickTemplate(t.id)}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '10px 14px',
                  background: active ? 'rgba(91,127,255,.08)' : 'transparent',
                  border: 'none',
                  borderLeft: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  cursor: 'pointer',
                  transition: 'all .12s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 16, flexShrink: 0 }}>{t.icon}</span>
                <div>
                  <div style={{
                    fontSize: 12, fontWeight: 600,
                    color: active ? 'var(--accent)' : 'var(--text)',
                  }}>
                    {t.label}
                    {active && <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--accent)', fontWeight: 700 }}>✓ Active</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, lineHeight: 1.4 }}>
                    {t.sub}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* ── Domain filter overlay ── */}
      {showDomains && !busy && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          zIndex: 50, borderRadius: 10,
          border: '1px solid var(--border2)',
          background: 'var(--surface)',
          boxShadow: '0 8px 32px rgba(0,0,0,.35)',
          overflow: 'hidden',
          animation: 'expandFromPoint .18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <div style={{
            padding: '8px 12px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginRight: 2 }}>Quick presets:</span>
            {DOMAIN_PRESETS.map((p) => (
              <button key={p.label}
                onClick={() => { setDomainAllow(p.allow); setDomainBlock(p.block) }}
                style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--surface2)', color: 'var(--text2)', transition: 'all .15s' }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
              >{p.label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            <div style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 7 }}>✓ Only search these</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7, minHeight: 24 }}>
                {domainAllow.map((d) => <DomainChip key={d} label={d} color="var(--green)" onRemove={() => setDomainAllow(domainAllow.filter((x) => x !== d))} />)}
                {domainAllow.length === 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>All domains allowed</span>}
              </div>
              <DomainInput value={allowInput} onChange={setAllowInput} onAdd={() => addAllow(allowInput)} placeholder=".gov, arxiv.org…" color="var(--green)" />
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 7 }}>✕ Never use these</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7, minHeight: 24 }}>
                {domainBlock.map((d) => <DomainChip key={d} label={d} color="var(--red)" onRemove={() => setDomainBlock(domainBlock.filter((x) => x !== d))} />)}
                {domainBlock.length === 0 && <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>No domains blocked</span>}
              </div>
              <DomainInput value={blockInput} onChange={setBlockInput} onAdd={() => addBlock(blockInput)} placeholder="reddit.com, twitter.com…" color="var(--red)" />
            </div>
          </div>
          {hasFilters && (
            <div style={{ padding: '7px 12px', borderTop: '1px solid var(--border)', background: 'var(--surface2)', fontSize: 10, color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{[focus.trim() && `Focus: "${focus.trim()}"`, domainAllow.length > 0 && `${domainAllow.length} allowed`, domainBlock.length > 0 && `${domainBlock.length} blocked`].filter(Boolean).join(' · ')}</span>
              <button onClick={() => { setDomainAllow([]); setDomainBlock([]); setFocus('') }} style={{ fontSize: 9, fontWeight: 700, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear all</button>
            </div>
          )}
        </div>
      )}

      {/* ── Upload overlay ── */}
      {showUploadBox && showUpload && !busy && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          zIndex: 50, borderRadius: 10,
          border: '1px solid rgba(157,127,240,.3)',
          background: 'var(--surface)',
          boxShadow: '0 8px 32px rgba(0,0,0,.35)',
          padding: 12,
          animation: 'expandFromPoint .18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}>
          <UploadZone />
        </div>
      )}
    </div>
  )
}

function DomainChip({ label, color, onRemove }: { label: string; color: string; onRemove: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 20, background: `${color}12`, border: `1px solid ${color}30`, fontSize: 10, color, fontFamily: 'JetBrains Mono, monospace' }}>
      {label}
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color, fontSize: 11, lineHeight: 1, padding: 0, opacity: 0.7 }}>✕</button>
    </div>
  )
}

function DomainInput({ value, onChange, onAdd, placeholder, color }: { value: string; onChange: (v: string) => void; onAdd: () => void; placeholder: string; color: string }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAdd()} placeholder={placeholder}
        style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 5, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: '4px 7px', outline: 'none' }}
        onFocus={(e) => e.target.style.borderColor = color}
        onBlur={(e)  => e.target.style.borderColor = 'var(--border2)'} />
      <button onClick={onAdd} style={{ padding: '4px 8px', borderRadius: 5, fontSize: 11, background: `${color}15`, border: `1px solid ${color}40`, color, cursor: 'pointer', fontWeight: 700 }}>+</button>
    </div>
  )
}
