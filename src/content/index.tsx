import { createRoot } from 'react-dom/client'
import { App } from './App'

import css from './tooltip.css?inline'

const HOST_ID = 'grasp-root'

function mount() {
  if (document.getElementById(HOST_ID)) return

  const host = document.createElement('div')
  host.id = HOST_ID

  host.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2147483647;'
  document.documentElement.appendChild(host)

  const shadow = host.attachShadow({ mode: 'closed' })
  const style = document.createElement('style')
  style.textContent = css
  shadow.appendChild(style)

  const container = document.createElement('div')
  shadow.appendChild(container)

  createRoot(container).render(<App />)
}

mount()
