import { useEffect, useState } from 'react'
import { apiRequest } from '../api'

export function useLicense() {
  const [license, setLicense] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    const load = () => apiRequest('/license').then(data => { if (alive) { setLicense(data); setError('') } }).catch(requestError => { if (alive) setError(requestError.message || 'Unable to load license status.') })
    load()
    const timer = window.setInterval(load, 60000)
    const refresh = () => load()
    window.addEventListener('nexclass-license-updated', refresh)
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('nexclass-license-updated', refresh) }
  }, [])
  return { license, error }
}
