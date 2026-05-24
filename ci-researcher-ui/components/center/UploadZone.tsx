'use client'
import { useAgentStore } from '@/store/agentStore'
import { useRef, useState } from 'react'
import { uploadFile } from '@/lib/api'
import type { UploadedFile } from '@/types/agent'

export default function UploadZone() {
  const uploadedFiles = useAgentStore((s) => s.uploadedFiles)
  const sessionId     = useAgentStore((s) => s.sessionId)
  const setFiles      = useAgentStore((s) => s.setUploadedFiles)
  const setMode       = useAgentStore((s) => s.setSourceMode)
  const setSessionId  = useAgentStore((s) => s.setSessionId)
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const hasFiles = uploadedFiles.length > 0

  async function handleFiles(fileList: FileList) {
    console.log('[upload] handleFiles called:', Array.from(fileList).map(f => f.name))
    if (!fileList.length) return
    setUploading(true)
    setError(null)

    let sid = sessionId ?? crypto.randomUUID()
    const added: UploadedFile[] = []

    for (const file of Array.from(fileList)) {
      try {
        const data = await uploadFile(file, sid)
        console.log('[upload] response:', data)
        sid = data.session_id
        added.push({
          id:   data.session_id,
          name: data.filename,
          size: formatSize(file.size),
        })
      } catch (err: any) {
        console.error('[upload] error:', err)
        setError(`Failed to upload ${file.name}: ${err.message}`)
      }
    }

    if (added.length > 0) {
      setSessionId(sid)
      setFiles([...uploadedFiles, ...added])
      setMode('hybrid')
    }

    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }

  function removeFile(id: string) {
    const next = uploadedFiles.filter((f) => f.id !== id)
    setFiles(next)
    if (next.length === 0) setMode('web')
  }

  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{
        fontSize: 10, fontWeight: 700, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '.6px',
        display: 'block', marginBottom: 7,
      }}>
        Internal Documents
      </label>

      {/* 
        Use <label htmlFor> instead of ref.click() — 
        this is the reliable cross-browser way to open file picker 
      */}
      <label
        htmlFor="file-upload-input"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
        style={{
          display: 'block',
          border: `1px ${hasFiles ? 'solid' : 'dashed'} ${hasFiles ? 'var(--purple)' : 'var(--border2)'}`,
          borderRadius: 7, padding: '12px 10px', textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer', transition: 'all .2s',
          background: hasFiles ? 'rgba(157,127,240,.06)' : 'var(--bg)',
          opacity: uploading ? 0.7 : 1,
        }}
        onMouseEnter={(e) => { if (!uploading) e.currentTarget.style.borderColor = 'var(--purple)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = hasFiles ? 'var(--purple)' : 'var(--border2)' }}
      >
        <div style={{ fontSize: 18, marginBottom: 3 }}>
          {uploading ? '⏳' : '📂'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
          {uploading
            ? 'Uploading & ingesting…'
            : hasFiles
              ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} ready`
              : 'Click or drag files here'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
          PDF, DOCX, TXT, XLSX, CSV
        </div>
        {sessionId && (
          <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 4, fontFamily: 'monospace' }}>
            session: {sessionId.slice(0, 8)}…
          </div>
        )}
      </label>

      {/* Input outside the label to avoid double-trigger on some browsers */}
      <input
        id="file-upload-input"
        type="file"
        multiple
        accept=".pdf,.docx,.txt,.xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files?.length) {
            handleFiles(e.target.files)
            // Reset input so same file can be re-uploaded
            e.target.value = ''
          }
        }}
      />

      {error && (
        <div style={{
          marginTop: 6, fontSize: 10, color: 'var(--red)',
          padding: '5px 8px', borderRadius: 5,
          background: 'rgba(255,79,79,.08)',
          border: '1px solid rgba(255,79,79,.2)',
        }}>
          {error}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div style={{ marginTop: 7, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {uploadedFiles.map((f) => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 8px', background: 'var(--surface2)',
              border: '1px solid rgba(157,127,240,.2)', borderRadius: 5, fontSize: 11,
            }}>
              <span>📄</span>
              <span style={{
                color: 'var(--purple)', flex: 1,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {f.name}
              </span>
              <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0 }}>
                {f.size}
              </span>
              <button
                onClick={(e) => { e.preventDefault(); removeFile(f.id) }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', fontSize: 12, padding: '0 2px', lineHeight: 1,
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