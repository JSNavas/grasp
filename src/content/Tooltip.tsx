import { useLayoutEffect, useState, type RefObject } from 'react'
import type { Analysis } from '@/lib/types'

export type TooltipState =
  | { status: 'loading' }
  | { status: 'ready'; analysis: Analysis }
  | { status: 'error'; message: string }
interface Props {
  anchor: DOMRect
  state: TooltipState
  boxRef: RefObject<HTMLDivElement | null>
  onClose: () => void
}

const GAP = 10

export function Tooltip({ anchor, state, boxRef, onClose }: Props) {
  const ref = boxRef
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)

  useLayoutEffect(() => {
    const el = ref.current as (HTMLDivElement & { showPopover?: () => void }) | null
    if (!el?.showPopover) return
    if (el.isConnected && !el.matches(':popover-open')) {
      try {
        el.showPopover()
      } catch {
        el.removeAttribute('popover')
      }
    }
  }, [state])

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const box = el.getBoundingClientRect()

    let top = anchor.bottom + GAP
    if (top + box.height > window.innerHeight - GAP) {
      top = Math.max(GAP, anchor.top - box.height - GAP)
    }
    const left = Math.min(
      Math.max(GAP, anchor.left),
      Math.max(GAP, window.innerWidth - box.width - GAP),
    )
    setPos({ left, top })
  }, [anchor, state])

  return (
    <div
      ref={ref}
      className="tooltip"
      popover="manual"
      style={{
        left: pos?.left ?? anchor.left,
        top: pos?.top ?? anchor.bottom + GAP,
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <button className="close" onClick={onClose} title="Cerrar (Esc)" aria-label="Cerrar">
        &#10005;
      </button>

      {state.status === 'loading' && (
        <div className="skeleton">
          <span />
          <span />
          <span />
        </div>
      )}

      {state.status === 'error' && <div className="status error">{state.message}</div>}

      {state.status === 'ready' && <Result analysis={state.analysis} />}
    </div>
  )
}

function Result({ analysis }: { analysis: Analysis }) {
  const notes = analysis.blocks.filter((b) => b.note)

  if (analysis.degraded || analysis.blocks.length === 0) {
    return <div className="status">{analysis.full}</div>
  }

  return (
    <>
      <div className="grid">
        {analysis.blocks.map((block, i) => (
          <div key={`${block.source}-${i}`} className={`block kind-${block.kind}`}>
            <span className="source">{block.source}</span>
            <span className="divider" />
            <span className="target">{block.target}</span>
          </div>
        ))}
      </div>

      <div className="full">{analysis.full}</div>

      {notes.map((block, i) => (
        <div key={`note-${i}`} className="note">
          <b>{block.source}</b> — {block.note}
        </div>
      ))}
    </>
  )
}
