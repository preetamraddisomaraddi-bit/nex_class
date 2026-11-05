import { useEffect, useState } from 'react'
import { getHODServerURL } from '../api'

export function useServerStatus() {
  const [server, setServer] = useState({ address: 'http://localhost:3000', online: false })
  useEffect(() => {
    let alive = true
    let timer
    const check = async () => {
      try {
        const info = await window.electronAPI?.getServerInfo?.()
        const protocol = info?.protocol || 'http'
        const host = info?.ip || 'localhost'
        const address = `${protocol}://${host}:${info?.port || 3000}`
        const serverUrl = await getHODServerURL()
        const response = await fetch(`${serverUrl}/api/health`, { cache: 'no-store' })
        const health = response.ok ? await response.json() : null
        if (alive) setServer({ address, online: Boolean(health?.dbOk && health?.status === 'ok') })
      } catch {
        if (alive) setServer(previous => ({ ...previous, online: false }))
      }
    }
    check()
    timer = window.setInterval(check, 10000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [])
  return server
}
