import { GoogleGenAI, ThinkingLevel, Type, type ThinkingConfig } from '@google/genai'
import type { Analysis, Block, BlockKind } from '@/lib/types'
import { skeleton } from '@/lib/text'

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite'

function thinkingFor(model: string): ThinkingConfig {
  return /^gemini-[3-9]/.test(model)
    ? { thinkingLevel: ThinkingLevel.LOW }
    : { thinkingBudget: 0 }
}

const SYSTEM_INSTRUCTION = `Eres un analizador linguistico para estudiantes de ingles hispanohablantes.

Recibes UNA frase. Detecta su idioma: si esta en ingles el objetivo es espanol; si esta en espanol el objetivo es ingles.

Divide la frase en BLOQUES SEMANTICOS y traduce cada bloque segun el contexto de la frase completa. Un bloque es la unidad minima que tiene significado propio:
- Manten juntos los phrasal verbs ("give up" -> "rendirse", NUNCA "dar" + "arriba").
- Manten juntos los modismos ("kick the bucket" -> "estirar la pata").
- Manten juntos verbo + pronombre objeto cuando el espanol los fusiona ("show me" -> "muestrame").
- Manten juntos determinante + sustantivo ("the way" -> "el camino").
- Manten juntos verbos compuestos y auxiliares ("have been working" -> "he estado trabajando").

REGLA ABSOLUTA E INVIOLABLE: la concatenacion de todos los campos "source", en orden y separados por un espacio, debe reproducir la frase original EXACTAMENTE, sin anadir, omitir, reordenar ni corregir una sola palabra. Copia los fragmentos literalmente del original, incluida la puntuacion. Si dudas, prefiere bloques mas grandes antes que perder texto.

Usa "note" solo cuando explique algo que el estudiante no deduciria del par source/target (por que un phrasal verb significa eso, un falso amigo, un uso idiomatico). Dejalo vacio en el resto de los casos. Las notas van SIEMPRE en espanol y en menos de 12 palabras.

"full" es la traduccion natural y fluida de la frase entera, no la suma de los bloques.`

const KINDS: BlockKind[] = [
  'noun_phrase',
  'verb_phrase',
  'phrasal_verb',
  'idiom',
  'adjective',
  'adverb',
  'preposition',
  'conjunction',
  'pronoun',
  'determiner',
  'punctuation',
  'other',
]

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    sourceLang: { type: Type.STRING, enum: ['en', 'es'] },
    targetLang: { type: Type.STRING, enum: ['en', 'es'] },
    full: { type: Type.STRING },
    blocks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          source: { type: Type.STRING },
          target: { type: Type.STRING },
          kind: { type: Type.STRING, enum: KINDS },
          note: { type: Type.STRING },
        },
        required: ['source', 'target', 'kind'],
        propertyOrdering: ['source', 'target', 'kind', 'note'],
      },
    },
  },
  required: ['sourceLang', 'targetLang', 'full', 'blocks'],
  propertyOrdering: ['sourceLang', 'targetLang', 'full', 'blocks'],
}

export class RateLimitError extends Error {
  readonly retryable = true

  readonly limit?: number

  constructor(message: string, limit?: number) {
    super(message)
    this.limit = limit
  }
}

function parseQuotaLimit(raw: string): number | undefined {
  try {
    const body = JSON.parse(raw.slice(raw.indexOf('{')))
    for (const detail of body?.error?.details ?? []) {
      for (const violation of detail?.violations ?? []) {
        const value = Number(violation?.quotaValue)
        if (Number.isFinite(value) && value > 0) return value
      }
    }
  } catch {}
  const match = /limit:\s*(\d+)/i.exec(raw)
  return match ? Number(match[1]) : undefined
}

export async function analyzeSentence(
  apiKey: string,
  model: string,
  text: string,
): Promise<Analysis> {
  const ai = new GoogleGenAI({ apiKey })

  let response
  try {
    response = await ai.models.generateContent({
      model,
      contents: text,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0,
        thinkingConfig: thinkingFor(model),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/429|RESOURCE_EXHAUSTED|quota/i.test(message)) {
      const limit = parseQuotaLimit(message)
      throw new RateLimitError(
        `Cuota de "${model}" agotada${limit ? ` (${limit}/dia)` : ''}. Cambia de modelo en el popup.`,
        limit,
      )
    }
    if (/API key not valid|401|403|PERMISSION_DENIED|UNAUTHENTICATED/i.test(message)) {
      throw new Error('API key invalida o sin permisos. Revisala en el popup de Grasp.')
    }
    if (/404|NOT_FOUND|no longer available/i.test(message)) {
      throw new Error(`El modelo "${model}" no esta disponible para tu cuenta. Elige otro en el popup.`)
    }
    if (/INVALID_ARGUMENT|400/i.test(message)) {
      throw new Error(`Peticion rechazada por el modelo "${model}": ${message}`)
    }
    throw new Error(message)
  }

  const raw = response.text
  if (!raw) throw new Error('Gemini devolvio una respuesta vacia')

  let parsed: Analysis
  try {
    parsed = JSON.parse(raw) as Analysis
  } catch {
    throw new Error('Gemini devolvio un JSON malformado')
  }

  return validate(parsed, text)
}

function validate(parsed: Analysis, original: string): Analysis {
  const blocks: Block[] = Array.isArray(parsed.blocks)
    ? parsed.blocks
        .filter((b) => b && typeof b.source === 'string' && b.source.trim().length > 0)
        .map((b) => ({
          source: b.source,
          target: typeof b.target === 'string' ? b.target : '',
          kind: KINDS.includes(b.kind) ? b.kind : 'other',
          note: b.note?.trim() ? b.note.trim() : undefined,
        }))
    : []

  const full = typeof parsed.full === 'string' && parsed.full.trim() ? parsed.full.trim() : ''
  const sourceLang = parsed.sourceLang === 'es' ? 'es' : 'en'
  const targetLang = sourceLang === 'en' ? 'es' : 'en'

  const aligned =
    blocks.length > 0 && skeleton(blocks.map((b) => b.source).join(' ')) === skeleton(original)

  const merged = aligned ? mergePunctuation(blocks) : blocks

  if (!aligned) {
    return {
      sourceLang,
      targetLang,
      full: full || original,
      blocks: [],
      degraded: true,
    }
  }

  return {
    sourceLang,
    targetLang,
    full: full || merged.map((b) => b.target).join(' '),
    blocks: merged,
  }
}

const PUNCT_ONLY = /^[\p{P}\p{S}\s]+$/u

function mergePunctuation(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    const prev = out[out.length - 1]
    if (prev && PUNCT_ONLY.test(b.source)) {
      prev.source = `${prev.source.trimEnd()}${b.source.trim()}`
      prev.target = `${prev.target.trimEnd()}${b.target.trim()}`
      continue
    }
    out.push({ ...b, source: b.source.trim(), target: b.target.trim() })
  }
  return out
}
