'use client'
import { useRef, useState } from 'react'
import { useAgentStore } from '@/store/agentStore'
import type { UploadedFile } from '@/types/agent'

const SOURCE_MODES = [
  { id: 'web',      label: '🌐 Web'    },
  { id: 'internal', label: '📁 Docs'   },
  { id: 'hybrid',   label: '⚡ Hybrid' },
] as const

// Handy domain presets
const DOMAIN_PRESETS = [
  { label: '🏛 Official only',  allow: ['.gov', '.edu', '.org'], block: [] },
  { label: '📰 No social',      allow: [], block: ['reddit.com', 'twitter.com', 'x.com', 'facebook.com'] },
  { label: '🔬 Academic',       allow: ['.edu', 'arxiv.org', 'scholar.google.com'], block: [] },
  { label: '🧹 Clear all',      allow: [], block: [] },
]

interface TopicInputProps {
  onRun: () => void
}

export default function TopicInput({ onRun }: TopicInputProps) {
  const topic         = useAgentStore((s) => s.topic)
  const setTopic      = useAgentStore((s) => s.setTopic)
  const focus         = useAgentStore((s) => s.focus)
  const setFocus      = useAgentStore((s) => s.setFocus)
  const sourceMode    = useAgentStore((s) => s.sourceMode)
  const setMode       = useAgentStore((s) => s.setSourceMode)
  const uploadedFiles = useAgentStore((s) => s.uploadedFiles)
  const setFiles      = useAgentStore((s) => s.setUploadedFiles)
  const domainAllow   = useAgentStore((s) => s.domainAllow)
  const domainBlock   = useAgentStore((s) => s.domainBlock)
  const setDomainAllow = useAgentStore((s) => s.setDomainAllow)
  const setDomainBlock = useAgentStore((s) => s.setDomainBlock)
  const phase         = useAgentStore((s) => s.phase)
  const busy          = phase === 'running' || phase === 'hitl'
  const inputRef      = useRef<HTMLInputElement>(null)

  const [showDomains, setShowDomains]   = useState(false)
  const [allowInput,  setAllowInput]    = useState('')
  const [blockInput,  setBlockInput]    = useState('')

  const showUpload = sourceMode === 'internal' || sourceMode === 'hybrid'
  const hasFilters = domainAllow.length > 0 || domainBlock.length > 0 || focus.trim().length > 0

  function handleFiles(fileList: FileList) {
    const added: UploadedFile[] = Array.from(fileList).map((f) => ({
      id:   Math.random().toString(36).slice(2),
      name: f.name,
      size: formatSize(f.size),
    }))
    setFiles([...uploadedFiles, ...added])
  }

  function removeFile(id: string) {
    const next = uploadedFiles.filter((f) => f.id !== id)
    setFiles(next)
    if (next.length === 0 && sourceMode === 'internal') setMode('web')
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) onRun()
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

  function applyPreset(allow: string[], block: string[]) {
    setDomainAllow(allow)
    setDomainBlock(block)
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>

      {/* Main search card */}
      <div style={{
        border: '1px solid var(--border2)',
        borderRadius: 12, background: 'var(--bg)',
        overflow: 'hidden', transition: 'border-color .2s, box-shadow .2s',
      }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent)'
          e.currentTarget.style.boxShadow   = '0 0 0 3px rgba(91,127,255,.1)'
        }}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            e.currentTarget.style.borderColor = 'var(--border2)'
            e.currentTarget.style.boxShadow   = 'none'
          }
        }}
      >
        {/* Topic textarea */}
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="What do you want to research? e.g. Compare HubSpot vs Salesforce AI features in 2025…"
          disabled={busy}
          style={{
            width: '100%', background: 'transparent',
            border: 'none', outline: 'none',
            color: 'var(--text)', fontFamily: 'Inter, sans-serif',
            fontSize: 14, padding: '16px 18px 10px',
            resize: 'none', lineHeight: 1.6,
            opacity: busy ? 0.6 : 1,
          }}
        />

        {/* Focus field — sits between textarea and bottom bar */}
        <div style={{
          padding: '6px 18px 10px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 11, color: 'var(--text3)', pointerEvents: 'none',
              fontWeight: 600,
            }}>
              Focus:
            </span>
            <input
              type="text"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={busy}
              placeholder="e.g. pricing only, enterprise features, compliance…"
              style={{
                width: '100%', background: 'transparent',
                border: 'none', outline: 'none',
                color: 'var(--text)', fontFamily: 'Inter, sans-serif',
                fontSize: 12, padding: '5px 10px 5px 52px',
                opacity: busy ? 0.6 : 1,
              }}
            />
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px',
          borderTop: '1px solid var(--border)',
          background: 'var(--surface2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Source mode pills */}
            {SOURCE_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                disabled={busy}
                style={{
                  padding: '4px 10px', borderRadius: 20,
                  fontSize: 11, fontWeight: 600,
                  cursor: busy ? 'default' : 'pointer',
                  border: `1px solid ${sourceMode === m.id ? 'var(--accent)' : 'var(--border2)'}`,
                  background: sourceMode === m.id ? 'rgba(91,127,255,.12)' : 'transparent',
                  color: sourceMode === m.id ? 'var(--accent)' : 'var(--text3)',
                  transition: 'all .15s',
                }}
              >
                {m.label}
              </button>
            ))}

            {/* Domain filter toggle */}
            <button
              onClick={() => setShowDomains((v) => !v)}
              disabled={busy}
              title="Domain filters"
              style={{
                padding: '4px 9px', borderRadius: 20,
                fontSize: 11, fontWeight: 600,
                cursor: busy ? 'default' : 'pointer',
                border: `1px solid ${hasFilters ? 'var(--yellow)' : showDomains ? 'var(--accent)' : 'var(--border2)'}`,
                background: hasFilters ? 'rgba(240,192,64,.1)' : showDomains ? 'rgba(91,127,255,.1)' : 'transparent',
                color: hasFilters ? 'var(--yellow)' : showDomains ? 'var(--accent)' : 'var(--text3)',
                transition: 'all .15s',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              🔒 Filters
              {hasFilters && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: 'var(--yellow)', color: '#000',
                  borderRadius: '50%', width: 14, height: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {domainAllow.length + domainBlock.length + (focus.trim() ? 1 : 0)}
                </span>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!busy && (
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>⌘ Enter to run</span>
            )}
            <button
              onClick={onRun}
              disabled={busy}
              style={{
                padding: '6px 16px', borderRadius: 7,
                background: busy
                  ? 'var(--border2)'
                  : 'linear-gradient(135deg, var(--accent2), var(--purple))',
                border: 'none', color: '#fff',
                fontSize: 12, fontWeight: 700,
                cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy ? 0.6 : 1,
                transition: 'opacity .15s', letterSpacing: '.2px',
                whiteSpace: 'nowrap',
              }}
            >
              {busy ? '⏳ Running…' : '▶ Run'}
            </button>
          </div>
        </div>
      </div>

      {/* Domain filter panel — slides in below input */}
      {showDomains && !busy && (
        <div style={{
          marginTop: 6, borderRadius: 10,
          border: '1px solid var(--border2)',
          background: 'var(--surface)',
          overflow: 'hidden',
          animation: 'fadeIn .15s ease',
        }}>
          {/* Presets row */}
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, marginRight: 2 }}>
              Quick presets:
            </span>
            {DOMAIN_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.allow, p.block)}
                style={{
                  padding: '3px 9px', borderRadius: 20, fontSize: 10,
                  fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border2)',
                  background: 'var(--surface2)',
                  color: 'var(--text2)', transition: 'all .15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.color = 'var(--accent)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border2)'
                  e.currentTarget.style.color = 'var(--text2)'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
            {/* Allow list */}
            <div style={{ padding: '10px 12px', borderRight: '1px solid var(--border)' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--green)',
                textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 7,
              }}>
                ✓ Only search these
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7, minHeight: 24 }}>
                {domainAllow.map((d) => (
                  <DomainChip key={d} label={d} color="var(--green)"
                    onRemove={() => setDomainAllow(domainAllow.filter((x) => x !== d))} />
                ))}
                {domainAllow.length === 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>
                    All domains allowed
                  </span>
                )}
              </div>
              <DomainInput
                value={allowInput}
                onChange={setAllowInput}
                onAdd={() => addAllow(allowInput)}
                placeholder=".gov, arxiv.org…"
                color="var(--green)"
              />
            </div>

            {/* Block list */}
            <div style={{ padding: '10px 12px' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'var(--red)',
                textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 7,
              }}>
                ✕ Never use these
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 7, minHeight: 24 }}>
                {domainBlock.map((d) => (
                  <DomainChip key={d} label={d} color="var(--red)"
                    onRemove={() => setDomainBlock(domainBlock.filter((x) => x !== d))} />
                ))}
                {domainBlock.length === 0 && (
                  <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic' }}>
                    No domains blocked
                  </span>
                )}
              </div>
              <DomainInput
                value={blockInput}
                onChange={setBlockInput}
                onAdd={() => addBlock(blockInput)}
                placeholder="reddit.com, twitter.com…"
                color="var(--red)"
              />
            </div>
          </div>

          {/* Active filter summary */}
          {hasFilters && (
            <div style={{
              padding: '7px 12px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface2)',
              fontSize: 10, color: 'var(--text3)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>
                {[
                  focus.trim() && `Focus: "${focus.trim()}"`,
                  domainAllow.length > 0 && `${domainAllow.length} allowed`,
                  domainBlock.length > 0 && `${domainBlock.length} blocked`,
                ].filter(Boolean).join(' · ')}
              </span>
              <button
                onClick={() => { setDomainAllow([]); setDomainBlock([]); setFocus('') }}
                style={{
                  fontSize: 9, fontWeight: 700, color: 'var(--red)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Upload zone */}
      {showUpload && (
        <div style={{ marginTop: 8, animation: 'fadeIn .2s ease' }}>
          <div
            onClick={() => !busy && inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); !busy && e.dataTransfer.files.length && handleFiles(e.dataTransfer.files) }}
            onDragOver={(e) => e.preventDefault()}
            style={{
              border: `1px dashed ${uploadedFiles.length ? 'var(--purple)' : 'var(--border2)'}`,
              borderRadius: 8, padding: '10px 14px',
              display: 'flex', alignItems: 'center', gap: 10,
              cursor: busy ? 'default' : 'pointer',
              background: uploadedFiles.length ? 'rgba(157,127,240,.05)' : 'transparent',
              transition: 'all .2s',
            }}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.borderColor = 'var(--purple)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = uploadedFiles.length ? 'var(--purple)' : 'var(--border2)' }}
          >
            <span style={{ fontSize: 20 }}>📂</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
                {uploadedFiles.length
                  ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} ready to search`
                  : 'Drop documents here or click to upload'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                PDF, DOCX, TXT — searched alongside {sourceMode === 'hybrid' ? 'the web' : 'nothing else'}
              </div>
            </div>
          </div>

          <input
            ref={inputRef} type="file" multiple accept=".pdf,.docx,.txt"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />

          {uploadedFiles.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
              {uploadedFiles.map((f) => (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 9px', borderRadius: 20,
                  background: 'var(--surface2)',
                  border: '1px solid rgba(157,127,240,.25)',
                  fontSize: 10, color: 'var(--purple)',
                }}>
                  📄 {f.name}
                  <button
                    onClick={() => removeFile(f.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text3)', fontSize: 11, lineHeight: 1, padding: 0,
                    }}
                  >✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Small reusable pieces ─────────────────────────────── */

function DomainChip({ label, color, onRemove }: {
  label: string; color: string; onRemove: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 7px', borderRadius: 20,
      background: `${color}12`, border: `1px solid ${color}30`,
      fontSize: 10, color, fontFamily: 'JetBrains Mono, monospace',
    }}>
      {label}
      <button
        onClick={onRemove}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color, fontSize: 11, lineHeight: 1, padding: 0, opacity: 0.7,
        }}
      >✕</button>
    </div>
  )
}

function DomainInput({ value, onChange, onAdd, placeholder, color }: {
  value: string; onChange: (v: string) => void
  onAdd: () => void; placeholder: string; color: string
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onAdd()}
        placeholder={placeholder}
        style={{
          flex: 1, background: 'var(--bg)',
          border: '1px solid var(--border2)', borderRadius: 5,
          color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace',
          fontSize: 10, padding: '4px 7px', outline: 'none',
          transition: 'border-color .15s',
        }}
        onFocus={(e) => e.target.style.borderColor = color}
        onBlur={(e)  => e.target.style.borderColor = 'var(--border2)'}
      />
      <button
        onClick={onAdd}
        style={{
          padding: '4px 8px', borderRadius: 5, fontSize: 11,
          background: `${color}15`, border: `1px solid ${color}40`,
          color, cursor: 'pointer', fontWeight: 700,
        }}
      >+</button>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}