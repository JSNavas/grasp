export interface Block {
  source: string
  target: string
  kind: BlockKind
  note?: string
}

export type BlockKind =
  | 'noun_phrase'
  | 'verb_phrase'
  | 'phrasal_verb'
  | 'idiom'
  | 'adjective'
  | 'adverb'
  | 'preposition'
  | 'conjunction'
  | 'pronoun'
  | 'determiner'
  | 'punctuation'
  | 'other'
export interface Analysis {
  sourceLang: 'en' | 'es'
  targetLang: 'en' | 'es'
  blocks: Block[]
  full: string
  degraded?: boolean
}
