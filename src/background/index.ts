import type { AnalyzeRequest, AnalyzeResponse } from '@/lib/messages'
import { bumpUsage, getSettings, rememberQuotaLimit } from '@/lib/settings'
import { isTranslatable, normalize } from '@/lib/text'
import * as cache from './cache'
import { analyzeSentence, DEFAULT_MODEL, RateLimitError } from './gemini'
import { QueueBusyError, RateLimitedQueue } from './queue'

let queue: RateLimitedQueue | null = null
let queueRpm = 0

function getQueue(rpm: number): RateLimitedQueue {
  if (!queue || queueRpm !== rpm) {
    queue = new RateLimitedQueue(rpm, 2)
    queueRpm = rpm
  }
  return queue
}

const inflight = new Map<string, Promise<AnalyzeResponse>>()

async function handleAnalyze(text: string): Promise<AnalyzeResponse> {
  const key = normalize(text)
  if (!isTranslatable(key)) {
    return { ok: false, error: 'Texto no traducible' }
  }

  const hit = await cache.get(key)
  if (hit) return { ok: true, analysis: hit.analysis, from: hit.from }

  const existing = inflight.get(key)
  if (existing) return existing

  const settings = await getSettings()
  if (!settings.apiKey) {
    return { ok: false, error: 'Falta la API key. Abre el popup de Grasp para configurarla.' }
  }

  const task = getQueue(settings.rpm)
    .run(async () => {
      await bumpUsage(settings.model)
      return analyzeSentence(settings.apiKey, settings.model, key)
    })
    .then(async (analysis): Promise<AnalyzeResponse> => {
      await cache.set(key, analysis)
      return { ok: true, analysis, from: 'api' }
    })
    .catch((err: unknown): AnalyzeResponse => {
      const message = err instanceof Error ? err.message : String(err)
      if (err instanceof RateLimitError && err.limit) {
        void rememberQuotaLimit(settings.model, err.limit)
      }
      const retryable = err instanceof RateLimitError || err instanceof QueueBusyError
      return { ok: false, error: message, retryable }
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, task)
  return task
}

const RETIRED_MODELS = /^gemini-(1\.5|2\.5|3\.6)/
async function migrateModel(): Promise<void> {
  const { model } = await getSettings()
  if (RETIRED_MODELS.test(model)) {
    await chrome.storage.local.set({ model: DEFAULT_MODEL })
  }
}
chrome.runtime.onInstalled.addListener(() => void migrateModel())
chrome.runtime.onStartup.addListener(() => void migrateModel())
void migrateModel()

chrome.runtime.onMessage.addListener((msg: AnalyzeRequest, _sender, sendResponse) => {
  if (msg?.type !== 'grasp:analyze') return false
  handleAnalyze(msg.text).then(sendResponse)
  return true
})

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-hover') return
  const { enabled } = await getSettings()
  await chrome.storage.local.set({ enabled: !enabled })
})
