import { sentenceAt } from '@/lib/text'

export interface HoverTarget {
  sentence: string
  rect: DOMRect
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'CODE', 'PRE'])

interface CaretHit {
  node: Text
  offset: number
}

function caretAt(x: number, y: number): CaretHit | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }

  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y)
    if (pos?.offsetNode.nodeType === Node.TEXT_NODE) {
      return { node: pos.offsetNode as Text, offset: pos.offset }
    }
    return null
  }

  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    if (range?.startContainer.nodeType === Node.TEXT_NODE) {
      return { node: range.startContainer as Text, offset: range.startOffset }
    }
  }
  return null
}

export function targetAt(x: number, y: number): HoverTarget | null {
  const hit = caretAt(x, y)
  if (!hit) return null

  const parent = hit.node.parentElement
  if (!parent || SKIP_TAGS.has(parent.tagName) || parent.isContentEditable) return null

  const data = hit.node.data
  const sentence = sentenceAt(data, Math.min(hit.offset, Math.max(0, data.length - 1)))
  if (!sentence) return null

  const range = document.createRange()
  range.selectNodeContents(hit.node)
  const rects = range.getClientRects()
  let rect = range.getBoundingClientRect()

  for (const r of rects) {
    if (y >= r.top && y <= r.bottom) {
      rect = r
      break
    }
  }
  range.detach()

  if (rect.width === 0 && rect.height === 0) return null
  return { sentence, rect }
}
