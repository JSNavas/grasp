export type TriggerKey = 'none' | 'shift' | 'alt' | 'ctrl'

export type Scope = 'sentence' | 'paragraph'

export interface Settings {
  apiKey: string
  model: string
  rpm: number
  hoverDelayMs: number
  triggerKey: TriggerKey
  scope: Scope
  enabled: boolean
}

export const DEFAULTS: Settings = {
  apiKey: '',
  model: 'gemini-3.5-flash-lite',
  rpm: 10,
  hoverDelayMs: 450,
  triggerKey: 'shift',
  scope: 'paragraph',
  enabled: true,
}

export interface Usage {
  day: string
  counts: Record<string, number>
}

export const today = (): string => new Date().toISOString().slice(0, 10)

export async function getUsage(): Promise<Usage> {
  const { usage } = (await chrome.storage.local.get({ usage: null })) as { usage: unknown }
  const u = usage as Partial<Usage> | null

  if (!u || u.day !== today() || typeof u.counts !== 'object' || u.counts === null) {
    return { day: today(), counts: {} }
  }
  return { day: u.day, counts: u.counts }
}

export async function bumpUsage(model: string): Promise<void> {
  const usage = await getUsage()
  usage.counts[model] = (usage.counts[model] ?? 0) + 1
  await chrome.storage.local.set({ usage })
}

export async function getQuotaLimits(): Promise<Record<string, number>> {
  const { quotaLimits } = await chrome.storage.local.get({ quotaLimits: {} })
  return (quotaLimits ?? {}) as Record<string, number>
}

export async function rememberQuotaLimit(model: string, limit: number): Promise<void> {
  const quotaLimits = await getQuotaLimits()
  if (quotaLimits[model] === limit) return
  quotaLimits[model] = limit
  await chrome.storage.local.set({ quotaLimits })
}

export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get({ ...DEFAULTS })
  return { ...DEFAULTS, ...stored } as Settings
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch)
}
