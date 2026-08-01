import type { Analysis } from './types'

export interface AnalyzeRequest {
  type: 'grasp:analyze'
  text: string
}

export interface AnalyzeOk {
  ok: true
  analysis: Analysis
  from: 'memory' | 'idb' | 'api'
}

export interface AnalyzeErr {
  ok: false
  error: string
  retryable?: boolean
}

export type AnalyzeResponse = AnalyzeOk | AnalyzeErr

const TIMEOUT_MS = 25_000

export async function analyze(text: string): Promise<AnalyzeResponse> {
  const msg: AnalyzeRequest = { type: 'grasp:analyze', text }

  try {
    const response = await Promise.race([
      chrome.runtime.sendMessage<AnalyzeRequest, AnalyzeResponse | undefined>(msg),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
      ),
    ])

    if (!response) return { ok: false, error: 'Sin respuesta del motor. Reintenta.', retryable: true }
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    if (/Extension context invalidated|context invalidated/i.test(message)) {
      return { ok: false, error: 'Grasp se actualizo: recarga la pagina (F5).' }
    }
    if (message === 'timeout') {
      return { ok: false, error: 'La peticion tardo demasiado. Reintenta.', retryable: true }
    }
    return { ok: false, error: 'No se pudo contactar con el motor. Reintenta.', retryable: true }
  }
}
