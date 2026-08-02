import { useEffect, useRef, useState } from 'react'
import { analyze } from '@/lib/messages'
import { DEFAULTS, getSettings, type Scope, type TriggerKey } from '@/lib/settings'
import { isTranslatable } from '@/lib/text'
import { selectionTarget, targetAt, type HoverTarget } from './caret'
import { Tooltip, type TooltipState } from './Tooltip'

export function App() {
  const [target, setTarget] = useState<HoverTarget | null>(null)
  const [state, setState] = useState<TooltipState>({ status: 'loading' })

  const boxRef = useRef<HTMLDivElement>(null)
  const enabled = useRef(DEFAULTS.enabled)
  const delayMs = useRef(DEFAULTS.hoverDelayMs)
  const trigger = useRef<TriggerKey>(DEFAULTS.triggerKey)
  const scope = useRef<Scope>(DEFAULTS.scope)

  const requestId = useRef(0)

  useEffect(() => {
    getSettings().then((s) => {
      enabled.current = s.enabled
      delayMs.current = s.hoverDelayMs
      trigger.current = s.triggerKey
      scope.current = s.scope
    })
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      if (changes.enabled) enabled.current = changes.enabled.newValue as boolean
      if (changes.hoverDelayMs) delayMs.current = changes.hoverDelayMs.newValue as number
      if (changes.triggerKey) trigger.current = changes.triggerKey.newValue as TriggerKey
      if (changes.scope) scope.current = changes.scope.newValue as Scope
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  useEffect(() => {
    let timer: number | undefined
    let lastSentence: string | null = null
    let lastX = -1
    let lastY = -1

    const insideBox = (x: number, y: number): boolean => {
      const el = boxRef.current
      if (!el) return false
      const r = el.getBoundingClientRect()
      const PAD = 12
      return x >= r.left - PAD && x <= r.right + PAD && y >= r.top - PAD && y <= r.bottom + PAD
    }

    const dismiss = () => {
      window.clearTimeout(timer)
      lastSentence = null
      requestId.current++
      setTarget(null)
    }

    const armed = (e: MouseEvent): boolean => {
      switch (trigger.current) {
        case 'shift':
          return e.shiftKey
        case 'alt':
          return e.altKey
        case 'ctrl':
          return e.ctrlKey || e.metaKey
        default:
          return true
      }
    }

    const lookup = (x: number, y: number) => {
      const hit = selectionTarget() ?? targetAt(x, y, scope.current)

      if (!hit || !isTranslatable(hit.sentence)) {
        if (lastSentence !== null) dismiss()
        return
      }

      if (hit.sentence === lastSentence) return

      lastSentence = hit.sentence
      const id = ++requestId.current
      setTarget(hit)
      setState({ status: 'loading' })

      analyze(hit.sentence).then((res) => {
        if (id !== requestId.current) return
        if (res.ok) {
          setState({ status: 'ready', analysis: res.analysis })
        } else {
          lastSentence = null
          setState({ status: 'error', message: res.error })
        }
      })
    }

    const onMove = (e: MouseEvent) => {
      if (!enabled.current) return
      lastX = e.clientX
      lastY = e.clientY

      if (insideBox(e.clientX, e.clientY)) {
        window.clearTimeout(timer)
        return
      }

      window.clearTimeout(timer)

      if (!armed(e)) {
        if (lastSentence !== null) dismiss()
        return
      }

      timer = window.setTimeout(() => lookup(e.clientX, e.clientY), delayMs.current)
    }

    const onScroll = () => {
      if (!insideBox(lastX, lastY)) dismiss()
    }
    const TRIGGER_KEYS: Record<Exclude<TriggerKey, 'none'>, string[]> = {
      shift: ['Shift'],
      alt: ['Alt'],
      ctrl: ['Control', 'Meta'],
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss()
        return
      }
      if (!enabled.current || e.repeat) return

      const keys = trigger.current === 'none' ? [] : TRIGGER_KEYS[trigger.current]
      if (!keys.includes(e.key)) return
      if (lastX < 0 || insideBox(lastX, lastY)) return

      window.clearTimeout(timer)
      lookup(lastX, lastY)
    }

    document.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('scroll', onScroll, { passive: true, capture: true })
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('blur', dismiss)

    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', dismiss)
    }
  }, [])

  if (!target) return null
  return <Tooltip anchor={target.rect} state={state} boxRef={boxRef} />
}
