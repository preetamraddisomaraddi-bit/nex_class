import { useMemo, useState } from 'react'
import { apiRequest } from '../api'
import { useToast } from '../components/AlertToast'
import { useLicense } from '../hooks/useLicense'
import { SALES_EMAIL } from '../config'

const headingFont = '"Plus Jakarta Sans", sans-serif'
const card = { background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', overflow: 'hidden' }
const statusStyle = { trial: ['Trial', 'var(--blue-light)', 'var(--blue)'], licensed: ['Active', 'var(--green-light)', 'var(--green)'], grace: ['Grace period', 'var(--amber-light)', 'var(--amber)'], expired: ['Expired', 'var(--red-light)', 'var(--red)'], unlicensed: ['Expired', 'var(--red-light)', 'var(--red)'], invalid: ['Expired', 'var(--red-light)', 'var(--red)'] }
const featureNames = { exams: 'Exams', codeRunner: 'Code Runner', ai: 'AI assistance' }
const date = value => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

function SeatMeter({ label, seat }) {
  const ratio = seat?.max ? seat.used / seat.max : 0
  const color = ratio >= 1 ? 'var(--red)' : ratio >= 0.8 ? 'var(--amber)' : 'var(--green)'
  return <div style={{ marginTop: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text2)' }}><strong>{label}</strong><span>{seat?.used ?? 0} / {seat?.max ?? 0}</span></div><div aria-label={`${label} seats used`} style={{ height: 8, marginTop: 7, borderRadius: 8, background: 'var(--bg)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, ratio * 100)}%`, height: '100%', borderRadius: 8, background: color, transition: 'width .2s ease' }} /></div></div>
}

export default function License() {
  const { license, error } = useLicense()
  const showToast = useToast()
  const [licenseText, setLicenseText] = useState('')
  const [activating, setActivating] = useState(false)
  const [activationError, setActivationError] = useState('')
  const state = license?.state || 'expired'
  const [label, badgeBg, badgeColor] = statusStyle[state] || statusStyle.expired
  const hodUniversity = useMemo(() => { try { return JSON.parse(window.localStorage.getItem('nexclass_hod_data') || '{}').university || '' } catch { return '' } }, [])
  const nameMismatch = license?.college && hodUniversity && license.college.trim().toLocaleLowerCase() !== hodUniversity.trim().toLocaleLowerCase()

  async function activate(raw) {
    if (!raw?.trim() || activating) return
    setActivating(true); setActivationError('')
    try {
      const result = await apiRequest('/license/activate', { method: 'POST', body: { license: raw } })
      setLicenseText(''); window.dispatchEvent(new Event('nexclass-license-updated'))
      showToast(`License ${result.state === 'licensed' ? 'activated' : 'updated'} successfully.`, 'success')
    } catch (requestError) { setActivationError(requestError.message || 'Unable to activate license.'); showToast(requestError.message || 'Unable to activate license.', 'error') }
    finally { setActivating(false) }
  }
  async function chooseFile() {
    try { const picked = await window.electronAPI?.pickLicenseFile?.(); if (picked?.content) { setLicenseText(picked.content); await activate(picked.content) } }
    catch (requestError) { setActivationError(requestError.message || 'Could not read the selected license file.') }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}><div><h1 style={{ margin: 0, fontFamily: headingFont, fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>License</h1><p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted)' }}>Manage this department's NexClass license and seat limits.</p></div><span style={{ padding: '6px 14px', borderRadius: 20, background: badgeBg, color: badgeColor, fontWeight: 700, fontSize: 12 }}>{label}</span></div>
    {error && <div role="alert" style={{ padding: 12, color: 'var(--red)', background: 'var(--red-light)', borderRadius: 8, fontSize: 13 }}>{error}</div>}
    {license && <div className="license-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 20 }}>
      <section style={{ ...card, padding: 20 }}><h2 style={{ margin: 0, fontFamily: headingFont, fontSize: 15, color: 'var(--text)' }}>License status</h2><div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}><span style={{ padding: '7px 14px', borderRadius: 20, background: badgeBg, color: badgeColor, fontFamily: headingFont, fontSize: 14, fontWeight: 800 }}>{label}</span><span style={{ color: 'var(--muted)', fontSize: 12 }}>{license.plan || 'No plan'}</span></div><div style={{ marginTop: 18, fontSize: 13, lineHeight: 1.8, color: 'var(--text2)' }}><div><strong>College:</strong> {license.college || hodUniversity || 'Not assigned'}</div><div><strong>Expires:</strong> {state === 'trial' ? date(license.trialEndsAt) : date(license.expiresAt)}</div><div><strong>Days left:</strong> {state === 'grace' ? Math.max(0, Math.ceil((new Date(license.graceEndsAt) - Date.now()) / 86400000)) : license.daysLeft}</div>{state === 'grace' && <div><strong>Grace ends:</strong> {date(license.graceEndsAt)}</div>}</div>{nameMismatch && <div role="status" style={{ marginTop: 14, padding: 10, borderRadius: 8, color: 'var(--amber)', background: 'var(--amber-light)', fontSize: 12 }}>The license is issued to “{license.college}”, while this department is set up as “{hodUniversity}”.</div>}</section>
      <section style={{ ...card, padding: 20 }}><h2 style={{ margin: 0, fontFamily: headingFont, fontSize: 15, color: 'var(--text)' }}>Seats</h2><SeatMeter label="Students" seat={license.seats?.students} /><SeatMeter label="Approved teachers" seat={license.seats?.teachers} /></section>
      <section style={{ ...card, padding: 20, gridColumn: '1 / -1' }}><h2 style={{ margin: 0, fontFamily: headingFont, fontSize: 15, color: 'var(--text)' }}>Included features</h2><div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>{Object.entries(featureNames).map(([key, name]) => { const enabled = (license.features || []).includes(key); return <span key={key} style={{ padding: '7px 11px', borderRadius: 20, color: enabled ? 'var(--green)' : 'var(--muted)', background: enabled ? 'var(--green-light)' : 'var(--bg)', fontSize: 12, fontWeight: 600 }}>{enabled ? '✓' : '✗'} {name}</span> })}</div></section>
    </div>}
    <section style={card}><div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}><h2 style={{ margin: 0, fontFamily: headingFont, fontSize: 15, color: 'var(--text)' }}>Activate license</h2><p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: 12 }}>Choose a .nexlicense file or paste the license JSON.</p></div><div style={{ padding: 20 }}><button type="button" onClick={chooseFile} disabled={activating} style={{ border: 0, borderRadius: 7, padding: '9px 14px', background: 'var(--indigo)', color: 'white', fontSize: 13, fontWeight: 600, cursor: activating ? 'wait' : 'pointer' }}>{activating ? 'Activating…' : 'Choose license file'}</button><div style={{ margin: '16px 0 8px', color: 'var(--muted)', fontSize: 12, fontWeight: 700 }}>OR PASTE LICENSE TEXT</div><textarea aria-label="License JSON" value={licenseText} onChange={event => setLicenseText(event.target.value)} placeholder="Paste the contents of your .nexlicense file" style={{ width: '100%', height: 120, resize: 'vertical', boxSizing: 'border-box', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 8, padding: 12, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }} /><button type="button" onClick={() => activate(licenseText)} disabled={activating || !licenseText.trim()} style={{ marginTop: 10, border: 0, borderRadius: 7, padding: '9px 14px', background: 'var(--green)', color: 'white', fontSize: 13, fontWeight: 600, cursor: activating || !licenseText.trim() ? 'not-allowed' : 'pointer', opacity: activating || !licenseText.trim() ? 0.6 : 1 }}>{activating ? 'Activating…' : 'Activate pasted license'}</button>{activationError && <div role="alert" style={{ marginTop: 12, color: 'var(--red)', background: 'var(--red-light)', borderRadius: 8, padding: 10, fontSize: 13 }}>{activationError}</div>}<p style={{ margin: '18px 0 0', color: 'var(--muted)', fontSize: 12 }}>Need a license? Contact <a href={`mailto:${SALES_EMAIL}`} style={{ color: 'var(--indigo)' }}>{SALES_EMAIL}</a></p></div></section>
    <style>{`@media(max-width:760px){.license-grid{grid-template-columns:1fr!important}.license-grid section{grid-column:auto!important}}`}</style>
  </div>
}
