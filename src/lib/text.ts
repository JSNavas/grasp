export function normalize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function skeleton(text: string): string {
  return normalize(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '')
}

const sentenceSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'sentence' })
    : null

export interface SentenceSpan {
  start: number
  end: number
}

export function sentenceSpanAt(text: string, offset: number): SentenceSpan | null {
  if (!text.length) return null
  if (!sentenceSegmenter) return { start: 0, end: text.length }

  for (const seg of sentenceSegmenter.segment(text)) {
    const end = seg.index + seg.segment.length
    if (offset >= seg.index && offset < end) {
      return trimSpan(text, seg.index, end)
    }
  }
  return null
}

function trimSpan(text: string, start: number, end: number): SentenceSpan | null {
  let s = start
  let e = end
  while (s < e && /\s/.test(text[s])) s++
  while (e > s && /\s/.test(text[e - 1])) e--
  return e > s ? { start: s, end: e } : null
}

export function sentenceAt(text: string, offset: number): string | null {
  const span = sentenceSpanAt(text, offset)
  if (!span) return null
  const s = normalize(text.slice(span.start, span.end))
  return s.length ? s : null
}

export function isTranslatable(text: string): boolean {
  if (text.length < 2 || text.length > 600) return false

  return /\p{L}{2}/u.test(text)
}
