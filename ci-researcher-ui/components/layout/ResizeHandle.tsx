'use client'
import { useRef, useCallback } from 'react'

interface ResizeHandleProps {
  onDrag: (delta: number) => void
}

export default function ResizeHandle({ onDrag }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastX    = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    lastX.current    = e.clientX
    document.body.style.cursor    = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      onDrag(e.clientX - lastX.current)
      lastX.current = e.clientX
    }

    const onUp = () => {
      dragging.current = false
      document.body.style.cursor    = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
  }, [onDrag])

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 4,
        flexShrink: 0,
        cursor: 'col-resize',
        background: 'var(--border)',
        position: 'relative',
        transition: 'background .15s',
        zIndex: 10,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--border)')}
    >
      {/* Grip dots */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex', flexDirection: 'column', gap: 3,
        pointerEvents: 'none',
      }}>
        {[0,1,2].map((i) => (
          <div key={i} style={{
            width: 2, height: 2, borderRadius: '50%',
            background: 'var(--border2)',
          }} />
        ))}
      </div>
    </div>
  )
}