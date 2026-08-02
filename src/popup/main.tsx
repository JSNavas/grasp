import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  DEFAULTS,
  getQuotaLimits,
  getSettings,
  getUsage,
  setSettings,
  today,
  type Settings,
  type Scope,
  type TriggerKey,
  type Usage,
} from '@/lib/settings'
import './popup.css'

const MODELS: Array<[value: string, label: string]> = [
  ['gemini-3.5-flash-lite', 'flash-lite 3.5 — mas cuota (recomendado)'],
  ['gemini-3.1-flash-lite', 'flash-lite 3.1 — mas cuota'],
  ['gemini-flash-lite-latest', 'flash-lite latest — mas cuota'],
  ['gemini-3.5-flash', 'flash 3.5 — mejor calidad, menos cuota'],
]

const SCOPES: Array<[value: Scope, label: string]> = [
  ['paragraph', 'El parrafo completo'],
  ['sentence', 'Solo la frase bajo el cursor'],
]

const TRIGGERS: Array<[value: TriggerKey, label: string]> = [
  ['shift', 'Manteniendo Shift (recomendado)'],
  ['alt', 'Manteniendo Alt'],
  ['ctrl', 'Manteniendo Ctrl / Cmd'],
  ['none', 'Solo pasar el raton — gasta mucha cuota'],
]

function Popup() {
  const [settings, setLocal] = useState<Settings>(DEFAULTS)
  const [saved, setSaved] = useState(false)
  const [used, setUsed] = useState<Usage>({ day: today(), counts: {} })
  const [limits, setLimits] = useState<Record<string, number>>({})

  useEffect(() => {
    getSettings().then(setLocal)
    getUsage().then(setUsed)
    getQuotaLimits().then(setLimits)
  }, [])

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setLocal((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const save = async () => {
    await setSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <>
      <header>
        <img src="/icons/icon48.png" width={34} height={34} alt="" />
        <div>
          <h1>Grasp</h1>
          <p className="sub">Traduccion por bloques semanticos</p>
        </div>
      </header>

      <label htmlFor="key">API key de Gemini</label>
      <input
        id="key"
        type="password"
        placeholder="AIza..."
        value={settings.apiKey}
        onChange={(e) => update('apiKey', e.target.value)}
      />

      <label htmlFor="model">Modelo</label>
      <select id="model" value={settings.model} onChange={(e) => update('model', e.target.value)}>
        {MODELS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor="trigger">Traducir al hacer hover</label>
      <select
        id="trigger"
        value={settings.triggerKey}
        onChange={(e) => update('triggerKey', e.target.value as TriggerKey)}
      >
        {TRIGGERS.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor="scope">Cuanto traducir</label>
      <select
        id="scope"
        value={settings.scope}
        onChange={(e) => update('scope', e.target.value as Scope)}
      >
        {SCOPES.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor="rpm">Limite de peticiones por minuto</label>
      <input
        id="rpm"
        type="number"
        min={1}
        max={60}
        value={settings.rpm}
        onChange={(e) => update('rpm', Number(e.target.value))}
      />

      <label htmlFor="delay">Retardo del hover (ms)</label>
      <input
        id="delay"
        type="number"
        min={100}
        max={2000}
        step={50}
        value={settings.hoverDelayMs}
        onChange={(e) => update('hoverDelayMs', Number(e.target.value))}
      />

      <div className="row">
        <input
          id="enabled"
          type="checkbox"
          checked={settings.enabled}
          onChange={(e) => update('enabled', e.target.checked)}
        />
        <label htmlFor="enabled">Modo hover activo (Alt+G)</label>
      </div>

      <label>Consumo de hoy</label>
      <ul className="usage">
        {MODELS.map(([value]) => {
          const n = used.counts[value] ?? 0
          const cap = limits[value]
          const pct = cap ? Math.min(100, (n / cap) * 100) : 0
          return (
            <li key={value} className={value === settings.model ? 'current' : undefined}>
              <div className="line">
                <span className="name">{value.replace('gemini-', '')}</span>
                <span className="count">
                  {n}
                  {cap ? ` / ${cap}` : ''}
                </span>
              </div>
              {cap ? (
                <div className="bar">
                  <i style={{ width: `${pct}%` }} />
                </div>
              ) : (
                <div className="unknown">tope aun desconocido</div>
              )}
            </li>
          )
        })}
      </ul>

      <button onClick={save}>Guardar</button>
      {saved && <p className="saved">Guardado</p>}

      <p className="hint">
        La key se guarda solo en este navegador (<code>chrome.storage.local</code>) y nunca sale de
        el salvo hacia la API de Google. Consiguela en{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
          Google AI Studio
        </a>
        .
      </p>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
)
