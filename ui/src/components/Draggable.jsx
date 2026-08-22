import { useState, useRef, useEffect } from 'react'

export default function Draggable({ id, initialPos, children, style = {} }) {
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(`lx_widget_pos_v2_${id}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return parsed;
        }
      }
      return initialPos
    } catch {
      return initialPos
    }
  })

  const [isDragging, setIsDragging] = useState(false)
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem('lx_hud_locked') === 'true')
  const dragRef = useRef(null)
  const offsetRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleStorage = () => setIsLocked(localStorage.getItem('lx_hud_locked') === 'true')
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const handlePointerDown = (e) => {
    // Check if HUD is locked by user
    if (isLocked) return;

    // STRICT FIX: Only allow dragging if the user explicitly clicked the title bar (.drag-handle)
    if (!e.target.closest('.drag-handle')) return;
    
    setIsDragging(true)
    offsetRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    }
    e.target.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!isDragging) return
    const newX = e.clientX - offsetRef.current.x
    const newY = e.clientY - offsetRef.current.y
    setPos({ x: newX, y: newY })
  }

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false)
    e.target.releasePointerCapture(e.pointerId)
    localStorage.setItem(`lx_widget_pos_v2_${id}`, JSON.stringify(pos))
  }

  return (
    <div 
      ref={dragRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: isDragging ? 100 : 50,
        cursor: isLocked ? 'default' : (isDragging ? 'grabbing' : 'grab'),
        touchAction: 'none',
        ...style
      }}
    >
      {children}
    </div>
  )
}
