'use client'
import { useAgentStore } from '@/store/agentStore'
import { useRef } from 'react'
import type { UploadedFile } from '@/types/agent'

export default function UploadZone() {
  const uploadedFiles  = useAgentStore((s) => s.uploadedFiles)
  const setFiles       = useAgentStore((s) => s.setUploadedFiles)
  const setMode        = useAgentStore((s) => s.setSourceMode)
  const inputRef       = useRef<HTMLInputElement>(null)
  const hasFiles       = uploadedFiles.length > 0

  function handleFiles(fileList: FileList) {
    const added: UploadedFile[] = Array.from(fileList).map((f) => ({
      id:   Math.random().toString(36).slice(2),
      name: f.name,
      size: formatSize(f.size),
    }))
    const next = [...uploadedFiles, ...added]
    setFiles(next)
    if (next.length > 0) setMode('hybrid')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  function removeFile(id: string) {
    const next = uploadedFiles.filter((f) => f.id !== id)
    setFiles(next)
    if (next.length === 0) setMode('web')
  }

  return (
    <div style={{ marginBottom:13 }}>
      <label style={{
        fontSize:10, fontWeight:700, color:'var(--text3)',
        textTransform:'uppercase', letterSpacing:'.6px',
        display:'block', marginBottom:7,
      }}>
        Internal Documents
      </label>

      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        style={{
          border:`1px dashed ${hasFiles ? 'var(--purple)' : 'var(--border2)'}`,
          borderStyle: hasFiles ? 'solid' : 'dashed',
          borderRadius:7, padding:'12px 10px', textAlign:'center',
          cursor:'pointer', transition:'all .2s',
          background: hasFiles ? 'rgba(157,127,240,.06)' : 'var(--bg)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--purple)')}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = hasFiles ? 'var(--purple)' : 'var(--border2)')}
      >
        <div style={{ fontSize:18, marginBottom:3 }}>📂</div>
        <div style={{ fontSize:11, color:'var(--text2)' }}>
          {hasFiles ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} uploaded` : 'Click or drag files here'}
        </div>
        <div style={{ fontSize:10, color:'var(--text3)', marginTop:2 }}>
          PDF, DOCX, TXT · Max 50 MB each
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.txt"
        style={{ display:'none' }}
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <div style={{ marginTop:7, display:'flex', flexDirection:'column', gap:4 }}>
          {uploadedFiles.map((f) => (
            <div key={f.id} style={{
              display:'flex', alignItems:'center', gap:7,
              padding:'5px 8px', background:'var(--surface2)',
              border:'1px solid rgba(157,127,240,.2)', borderRadius:5,
              fontSize:11,
            }}>
              <span>📄</span>
              <span style={{ color:'var(--purple)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {f.name}
              </span>
              <span style={{ fontSize:10, color:'var(--text3)', flexShrink:0 }}>{f.size}</span>
              <button
                onClick={() => removeFile(f.id)}
                style={{
                  background:'none', border:'none', cursor:'pointer',
                  color:'var(--text3)', fontSize:12, padding:'0 2px',
                  lineHeight:1,
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}