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

export function sentenceAt(text: string, offset: number): string | null {
  if (!sentenceSegmenter) {
    const t = normalize(text)
    return t.length ? t : null
  }
  for (const seg of sentenceSegmenter.segment(text)) {
    if (offset >= seg.index && offset < seg.index + seg.segment.length) {
      const s = normalize(seg.segment)
      return s.length ? s : null
    }
  }
  return null
}

export function isTranslatable(text: string): boolean {
  if (text.length < 2 || text.length > 600) return false

  return /\p{L}{2}/u.test(text)
}
