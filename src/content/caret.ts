import { normalize, sentenceSpanAt } from '@/lib/text'

export interface HoverTarget {
  sentence: string
  rect: DOMRect
}

const HARD_SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT'])
const TRIGGER_SKIP = new Set(['CODE', 'PRE', 'KBD', 'SAMP'])
const INLINE_DISPLAYS = new Set(['inline', 'contents', 'ruby', 'ruby-base', 'ruby-text'])
const MAX_BLOCK_CHARS = 6000

interface CaretHit {
  node: Text
  offset: number
}

interface Piece {
  node: Text
  start: number
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

function containerOf(node: Text): HTMLElement | null {
  let el = node.parentElement
  while (el) {
    if (HARD_SKIP.has(el.tagName)) return null
    if (!INLINE_DISPLAYS.has(getComputedStyle(el).display)) return el
    el = el.parentElement
  }
  return null
}

function collect(container: HTMLElement, target: Text) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = (node as Text).parentElement
      if (!parent || HARD_SKIP.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })

  const pieces: Piece[] = []
  let text = ''
  let targetStart = -1
  let node: Node | null

  while ((node = walker.nextNode())) {
    const textNode = node as Text
    if (textNode === target) targetStart = text.length
    pieces.push({ node: textNode, start: text.length })
    text += textNode.data
    if (text.length > MAX_BLOCK_CHARS) break
  }

  return targetStart < 0 ? null : { text, pieces, targetStart }
}

function locate(pieces: Piece[], offset: number): { node: Text; offset: number } | null {
  for (let i = pieces.length - 1; i >= 0; i--) {
    const piece = pieces[i]
    if (offset >= piece.start) {
      return { node: piece.node, offset: Math.min(offset - piece.start, piece.node.data.length) }
    }
  }
  return null
}

function rectFor(range: Range, y: number): DOMRect | null {
  const rects = range.getClientRects()
  let rect = range.getBoundingClientRect()
  for (const candidate of rects) {
    if (y >= candidate.top && y <= candidate.bottom) {
      rect = candidate
      break
    }
  }
  return rect.width === 0 && rect.height === 0 ? null : rect
}

export function targetAt(x: number, y: number): HoverTarget | null {
  const hit = caretAt(x, y)
  if (!hit) return null

  const parent = hit.node.parentElement
  if (!parent || parent.isContentEditable) return null
  if (HARD_SKIP.has(parent.tagName) || TRIGGER_SKIP.has(parent.tagName)) return null

  const container = containerOf(hit.node)
  if (!container) return null

  const collected = collect(container, hit.node)
  if (!collected) return null

  const { text, pieces, targetStart } = collected
  const cursor = Math.min(targetStart + hit.offset, Math.max(0, text.length - 1))
  const span = sentenceSpanAt(text, cursor)
  if (!span) return null

  const sentence = normalize(text.slice(span.start, span.end))
  if (!sentence) return null

  const from = locate(pieces, span.start)
  const to = locate(pieces, span.end)
  if (!from || !to) return null

  const range = document.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  const rect = rectFor(range, y)
  range.detach()

  return rect ? { sentence, rect } : null
}
