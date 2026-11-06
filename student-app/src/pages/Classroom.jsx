import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getAPI, getExam, getMyScores, submitScore } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import { getSocket, joinRoom as joinSocketRoom, startHeartbeat, stopHeartbeat, leaveRoom, emitForceClose } from '../socket.js'
import { jsPDF } from 'jspdf'
import ThemeToggle from '../components/ThemeToggle.jsx'

const TABS = ['Board', 'Code', 'Notes', 'Exam']

export default function Classroom() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { student } = useAuth()
  const [launchedExam, setLaunchedExam] = useState(null)
  const [room, setRoom] = useState(null)
  const [tab, setTab] = useState('Board')
  const [activeScreenShare, setActiveScreenShare] = useState(false)
  const [remoteStream, setRemoteStream] = useState(null)
  const socket = getSocket()

  // PDF & Slide Presenter states
  const [receivedPDFs, setReceivedPDFs] = useState([])
  const [viewPdfUrl, setViewPdfUrl] = useState('')
  const [viewPdfName, setViewPdfName] = useState('')
  const [slidesPresenting, setSlidesPresenting] = useState(false)
  const [currentSlideImage, setCurrentSlideImage] = useState(null)
  const [slideIndex, setSlideIndex] = useState(0)
  const [totalSlides, setTotalSlides] = useState(0)

  const peerRef = useRef(null)
  const videoRef = useRef(null)

  function closePeerConnection() {
    if (peerRef.current) {
      peerRef.current.close()
      peerRef.current = null
    }
    setRemoteStream(null)
    if (videoRef.current) videoRef.current.srcObject = null
  }

  // Bind remote screen share stream to video element when tab shifts or stream updates
  useEffect(() => {
    if (videoRef.current && remoteStream) {
      console.log('[WebRTC] Assigning stream to video element')
      videoRef.current.srcObject = remoteStream
      videoRef.current.play().catch(err => {
        console.error('[WebRTC] Video playback failed or blocked:', err)
      })
    }
  }, [remoteStream, tab, activeScreenShare])

  useEffect(() => {
    loadRoom()

    // Lock into kiosk Focus Mode
    if (window.electronAPI) {
      window.electronAPI.enterFocusMode()
    }

    joinSocketRoom(student, roomCode)
    startHeartbeat(student, roomCode, 'focused')

    const handleExamStarted = data => {
      setLaunchedExam(data)
      setTab('Exam')
    }
    socket.on('exam:launched', handleExamStarted)

    const handleScreenStarted = ({ from }) => {
      console.log('[WebRTC] Screen sharing started by:', from)
      setActiveScreenShare(true)
      socket.emit('screen:request', { room_code: roomCode, to: from })
    }

    const handleScreenStopped = () => {
      console.log('[WebRTC] Screen sharing stopped')
      closePeerConnection()
      setActiveScreenShare(false)
    }

    const handleScreenOfferEvent = async ({ offer, from }) => {
      console.log('[WebRTC] Received offer from:', from)
      closePeerConnection()
      setActiveScreenShare(true)

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      })
      peerRef.current = pc

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState)
      }
      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection State:', pc.connectionState)
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('screen:ice-candidate', {
            room_code: roomCode,
            candidate: e.candidate,
            to: from
          })
        }
      }

      pc.ontrack = (e) => {
        console.log('[WebRTC] Received remote stream track!')
        setRemoteStream(e.streams[0])
      }

      try {
        await pc.setRemoteDescription(offer)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socket.emit('screen:answer', {
          room_code: roomCode,
          answer,
          to: from
        })
      } catch (err) {
        console.error('Error establishing screen share WebRTC:', err)
      }
    }

    const handleScreenIceCandidateEvent = async ({ candidate }) => {
      if (peerRef.current && candidate) {
        try {
          await peerRef.current.addIceCandidate(candidate)
          console.log('[WebRTC] Added ICE candidate successfully')
        } catch (err) {
          console.error('Error adding ICE candidate:', err)
        }
      }
    }

    // Pushed PDF socket receiver
    const handlePdfReceive = (pdf) => {
      setReceivedPDFs(prev => [pdf, ...prev])
      alert(`📄 Shared PDF: "${pdf.filename}" has been pushed by the teacher!`)
    }

    // Presentation Slide socket receivers
    const handleSlidesStarted = ({ total_slides, current_slide }) => {
      setSlidesPresenting(true)
      setTotalSlides(total_slides)
      setSlideIndex(current_slide || 0)
    }

    const handleSlidesPage = ({ page_index, image }) => {
      setSlideIndex(page_index)
      setCurrentSlideImage(image)
    }

    const handleSlidesEnded = () => {
      setSlidesPresenting(false)
      setCurrentSlideImage(null)
      setSlideIndex(0)
      setTotalSlides(0)
    }

    // Release from kiosk Focus Mode when teacher ends the classroom session
    const handleSessionEnded = () => {
      if (window.electronAPI) window.electronAPI.exitFocusMode()
      alert('The class session has been ended by the teacher.')
      navigate('/dashboard')
    }

    socket.on('screen:started', handleScreenStarted)
    socket.on('screen:stopped', handleScreenStopped)
    socket.on('screen:offer', handleScreenOfferEvent)
    socket.on('screen:ice-candidate', handleScreenIceCandidateEvent)
    socket.on('pdf:receive', handlePdfReceive)
    socket.on('slides:started', handleSlidesStarted)
    socket.on('slides:page', handleSlidesPage)
    socket.on('slides:ended', handleSlidesEnded)
    socket.on('session:ended', handleSessionEnded)

    // Periodic Heartbeat Status Updates
    const heartbeat = setInterval(() => {
      socket.emit('student:heartbeat', {
        room_code: roomCode,
        student_id: student.id,
        name: student.name,
        status: document.hasFocus() ? 'focused' : 'unfocused',
        timestamp: new Date().toISOString()
      })
    }, 30000)

    // Window force-close IPC trigger from main process
    if (window.electronAPI) {
      window.electronAPI.onFocusModeForceClosed(() => {
        emitForceClose({ room_code: roomCode, name: student.name, usn: student.usn })
      })
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.exitFocusMode()
      }
      clearInterval(heartbeat)
      stopHeartbeat()
      leaveRoom(roomCode)
      socket.off('exam:launched', handleExamStarted)
      socket.off('screen:started', handleScreenStarted)
      socket.off('screen:stopped', handleScreenStopped)
      socket.off('screen:offer', handleScreenOfferEvent)
      socket.off('screen:ice-candidate', handleScreenIceCandidateEvent)
      socket.off('pdf:receive', handlePdfReceive)
      socket.off('slides:started', handleSlidesStarted)
      socket.off('slides:page', handleSlidesPage)
      socket.off('slides:ended', handleSlidesEnded)
      socket.off('session:ended', handleSessionEnded)
      closePeerConnection()
    }
  }, [])

  async function loadRoom() {
    try {
      const { data } = await getAPI().get(`/rooms/${roomCode}`)
      const roomData = data.room || data
      setRoom(roomData)
      setReceivedPDFs([])
    } catch (err) {
      console.error('[Student Classroom] load error:', err)
      navigate('/dashboard')
    }
  }

  async function handleViewPDF(pdf) {
    try {
      const { data } = await getAPI().get(`/pdfs/${pdf.id}/download`, { responseType: 'arraybuffer' })
      const blob = new Blob([data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setViewPdfUrl(url)
      setViewPdfName(pdf.filename)
    } catch (err) {
      console.error('[PDF View] Error:', err)
      alert('Failed to render PDF preview.')
    }
  }

  async function handleDownloadPDF(pdf) {
    try {
      const { data } = await getAPI().get(`/pdfs/${pdf.id}/download`, { responseType: 'arraybuffer' })
      const base64 = btoa(
        new Uint8Array(data).reduce((acc, byte) => acc + String.fromCharCode(byte), '')
      )
      if (window.electronAPI) {
        const success = await window.electronAPI.savePDF(pdf.filename, base64)
        if (success) alert(`Saved PDF "${pdf.filename}" successfully!`)
      } else {
        const blob = new Blob([data], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = pdf.filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('[PDF Download] Error:', err)
      alert('Failed to download PDF file.')
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] text-white overflow-hidden select-none relative">

      {/* PDF View Modal Overlay */}
      {viewPdfUrl && (
        <div className="fixed inset-0 bg-black/85 flex flex-col z-[9999] p-6 backdrop-blur-sm">
          <div className="bg-[var(--card)] rounded-t-2xl px-6 py-4 flex items-center justify-between border-b border-[var(--border)]">
            <p className="font-bold text-white text-base flex items-center gap-2">
              <span>📄</span> {viewPdfName}
            </p>
            <button onClick={() => { URL.revokeObjectURL(viewPdfUrl); setViewPdfUrl(''); }}
              className="bg-[var(--red-soft)] hover:bg-[var(--red-soft)] text-[var(--red)] border border-[var(--border)] px-4 py-1.5 rounded-lg text-xs font-bold transition-all">
              ✕ Close Preview
            </button>
          </div>
          <iframe src={viewPdfUrl} className="flex-1 w-full bg-white rounded-b-2xl border-none" />
        </div>
      )}

      {/* Header */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] pl-6 pr-[140px] py-3 flex items-center justify-between drag-region flex-shrink-0">
        <div className="flex items-center gap-4 no-drag">
          <button onClick={() => navigate('/dashboard')} className="text-[var(--muted)] hover:text-white transition-colors">←</button>
          <div>
            <h1 className="font-bold text-white leading-none">{room?.subject}</h1>
            <p className="text-xs text-[var(--muted)]">{room?.topic || 'No topic'}</p>
          </div>
          <span className="font-mono bg-[var(--accent-soft)] text-[var(--accent)] px-3 py-1 rounded-lg text-sm font-bold border border-[var(--border)]">
            {roomCode}
          </span>
          <span className="text-xs text-[var(--muted)]">Teacher: {room?.teacher_name || 'Instructor'}</span>
          <span className="text-xs text-[var(--amber)] bg-[var(--amber-soft)] px-2.5 py-1 rounded-full border border-[var(--border)] font-semibold flex items-center gap-1">
            🔒 Focus Mode Active
          </span>
        </div>
        <div className="no-drag flex items-center gap-2">
          <ThemeToggle compact />
          <button onClick={() => navigate('/dashboard')} className="bg-[var(--card2)] hover:bg-[var(--border)] text-[var(--text2)] text-sm px-4 py-2 rounded-lg transition-colors">
            Exit Class
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-[var(--card)] border-b border-[var(--border)] px-6 flex gap-1 flex-shrink-0 no-drag">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t ? 'border-indigo-500 text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-white'}`}>
            {t}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden relative">
        {tab === 'Board' && (
          slidesPresenting ? (
            <div className="h-full flex flex-col bg-[var(--surface)] border border-[var(--border)] relative">
              <div className="bg-[var(--card)] border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-sm font-semibold text-white">Live Slide Presentation</p>
                </div>
                <div className="flex items-center">
                  <span className="text-xs text-[var(--accent)] font-mono font-bold bg-[var(--accent-soft)] border border-indigo-500/20 px-2.5 py-1 rounded">
                    Slide {slideIndex + 1} of {totalSlides}
                  </span>
                </div>
              </div>
              <div className="flex-grow bg-black flex items-center justify-center p-4">
                {currentSlideImage ? (
                  <img src={currentSlideImage} className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-[var(--border)] animate-fade-in" alt="presentation slide" />
                ) : (
                  <p className="text-[var(--muted)] text-sm">Waiting for slide contents...</p>
                )}
              </div>
            </div>
          ) : activeScreenShare ? (
            <div className="h-full w-full bg-black relative flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              <div className="absolute top-3 left-4 bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--accent)] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                Live Screen Broadcast
              </div>
            </div>
          ) : (
            <BoardTab roomCode={roomCode} socket={socket} />
          )
        )}
        {tab === 'Code' && <CodeTab roomCode={roomCode} socket={socket} student={student} room={room} />}
        {tab === 'Notes' && <NotesTab room={room} receivedPDFs={receivedPDFs} handleViewPDF={handleViewPDF} handleDownloadPDF={handleDownloadPDF} />}
        {tab === 'Exam' && <ExamTab roomCode={roomCode} socket={socket} student={student} room={room} launchedExam={launchedExam} />}
      </div>
    </div>
  )
}

// ── BOARD VIEWER ───────────────────────────────────────────
function BoardTab({ socket }) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctxRef.current = ctx

    socket.on('board:draw', handleDraw)
    socket.on('board:clear', handleClear)

    return () => {
      socket.off('board:draw')
      socket.off('board:clear')
    }
  }, [])

  function handleDraw({ drawData }) {
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.strokeStyle = drawData.color
    ctx.lineWidth = drawData.size
    ctx.beginPath()
    ctx.moveTo(drawData.from.x, drawData.from.y)
    ctx.lineTo(drawData.to.x, drawData.to.y)
    ctx.stroke()
  }

  function handleClear() {
    if (ctxRef.current && canvasRef.current) {
      ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[var(--board-bg)] relative">
      <div className="absolute top-3 left-4 bg-[var(--card)]/90 backdrop-blur border border-[var(--border)] rounded-lg px-3 py-1.5 text-xs text-[var(--muted)]">
        🖊️ Real-Time Board Broadcast (Read Only)
      </div>
      <canvas ref={canvasRef} className="flex-1 w-full bg-[var(--board-bg)]" />
    </div>
  )
}

// ── CODE EDITOR & COMPILER ─────────────────────────────────
function CodeTab({ roomCode, socket, student, room }) {
  const [code, setCode] = useState('# Write your code here\nprint("Hello, World!")')
  const [language, setLanguage] = useState('python')
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiHint, setAiHint] = useState('')
  const [showAiPanel, setShowAiPanel] = useState(false)

  const languages = ['python', 'javascript', 'java', 'c', 'cpp']

  useEffect(() => {
    socket.on('code:received', handleBroadcast)
    return () => { socket.off('code:received') }
  }, [])

  function handleBroadcast({ code, language }) {
    setCode(code)
    setLanguage(language)
    setOutput('Code broadcast from teacher loaded!')
  }

  async function runCode() {
    setRunning(true)
    setOutput('Compiling and running on the department server...')
    try {
      const { data } = await getAPI().post('/code/execute', { code, language }, { timeout: 20000 })
      setOutput(data.output || 'Execution completed. (No output returned)')
    } catch (error) {
      setOutput(error.response?.data?.error || 'Could not run code. Check that the department server and its local code runner are available.')
    } finally {
      setRunning(false)
    }
  }

  async function submitCode() {
    if (!room) return
    setSubmitting(true)
    try {
      await getAPI().post('/code/submit', { room_id: room.id, code, language, output })
      alert('Code submitted successfully to the teacher!')
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to submit code.')
    } finally {
      setSubmitting(false)
    }
  }

  async function askAI() {
    setAiLoading(true)
    setShowAiPanel(true)
    setAiHint('Asking AI Teaching Assistant for guidance...')
    try {
      const { data } = await getAPI().post('/ai/hint', { code, language })
      setAiHint(data.hint || 'No hint returned.')
    } catch {
      setAiHint('Could not communicate with the AI hint engine.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="bg-[var(--card)] border-b border-[var(--border)] px-4 py-2.5 flex items-center gap-3">
          <select value={language} onChange={e => setLanguage(e.target.value)}
            className="bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-1.5 text-sm text-white">
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>

          <button onClick={runCode} disabled={running}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors font-medium">
            {running ? 'Running...' : '▶ Run Code'}
          </button>

          <button onClick={submitCode} disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition-colors font-medium">
            {submitting ? 'Submitting...' : '📤 Submit Code'}
          </button>

          <button onClick={askAI}
            className="ml-auto bg-amber-600 hover:bg-amber-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5">
            🤖 Ask AI
          </button>
        </div>

        <p className="px-4 pt-1 text-[10px] text-[var(--muted)]">Ask AI sends the current code to Gemini. Free-tier prompts may be used to improve Google products; leave out personal or sensitive information.</p>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col">
          <textarea value={code} onChange={e => setCode(e.target.value)}
            className="flex-1 bg-[#0d1117] text-green-400 font-mono text-sm p-5 resize-none focus:outline-none"
            spellCheck={false}
          />
          <div className="h-40 bg-[#161b22] border-t border-slate-700/60 p-4 font-mono text-sm overflow-y-auto text-[#CBD5E1]">
            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Execution Output</div>
            <pre className="whitespace-pre-wrap">{output || 'No output yet. Click "Run Code" to compile.'}</pre>
          </div>
        </div>
      </div>

      {/* AI Panel */}
      {showAiPanel && (
        <div className="w-80 border-l border-[var(--border)] bg-[var(--card)] p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">🤖 Gemini AI Hint</h3>
            <button onClick={() => setShowAiPanel(false)} className="text-[var(--muted)] hover:text-white">✕</button>
          </div>
          <div className="bg-[var(--surface)] rounded-xl p-4 border border-[var(--border)] flex-1 overflow-y-auto text-sm text-[var(--text2)] whitespace-pre-wrap leading-relaxed">
            {aiHint}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── NOTES DOWNLOAD ─────────────────────────────────────────
function NotesTab({ room, receivedPDFs, handleViewPDF, handleDownloadPDF }) {
  const [notes, setNotes] = useState([])
  const [subTab, setSubTab] = useState('notes') // 'notes' or 'pdfs'
  const socket = getSocket()

  useEffect(() => {
    if (room) setNotes(room.notes || [])
    const handleNoteReceived = note => {
      if (note.room_code && note.room_code !== room?.code) return
      const normalized = { ...note, title: note.title || 'Class Note' }
      setNotes(prev => prev.some(item => item.id === normalized.id) ? prev : [...prev, normalized])
    }
    socket.on('note:received', handleNoteReceived)
    return () => socket.off('note:received', handleNoteReceived)
  }, [room, socket])

  function downloadPDF(note) {
    const doc = new jsPDF()

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(99, 102, 241) // Indigo accent
    doc.text('EduSync Class Note', 20, 20)

    doc.setFontSize(10)
    doc.setTextColor(100, 116, 139) // Slate subtext
    doc.text(`Subject: ${room?.subject || ''}`, 20, 30)
    doc.text(`Topic: ${room?.topic || ''}`, 20, 36)
    doc.text(`Class: ${room?.class_name || ''}`, 20, 42)
    doc.text(`Date: ${new Date(note.pushed_at).toLocaleString()}`, 20, 48)

    doc.setLineWidth(0.5)
    doc.setDrawColor(203, 213, 225)
    doc.line(20, 52, 190, 52)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(15, 23, 42) // Dark Slate
    doc.text(note.title, 20, 62)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(51, 65, 85)
    const textLines = doc.splitTextToSize(note.content, 170)
    doc.text(textLines, 20, 72)

    doc.save(`Note_${note.title.replace(/\s+/g, '_')}.pdf`)
  }

  return (
    <div className="h-full p-6 overflow-y-auto max-w-4xl mx-auto flex flex-col">
      {/* Sub tabs switcher */}
      <div className="flex border-b border-[var(--border)] mb-6 gap-6">
        <button onClick={() => setSubTab('notes')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px px-1
            ${subTab === 'notes' ? 'border-indigo-500 text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-white'}`}>
          📝 Class Notes ({notes.length})
        </button>
        <button onClick={() => setSubTab('pdfs')}
          className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px px-1
            ${subTab === 'pdfs' ? 'border-indigo-500 text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-white'}`}>
          📄 Shared PDFs ({receivedPDFs.length})
        </button>
      </div>

      {subTab === 'notes' ? (
        notes.length === 0 ? (
          <div className="text-center text-[var(--muted)] mt-12 flex-grow">
            <p className="text-5xl mb-2">📝</p>
            <p className="font-semibold text-[var(--muted)]">No notes pushed yet by the teacher</p>
          </div>
        ) : (
          <div className="space-y-4 flex-grow">
            {notes.map(n => (
              <div key={n.id} className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] flex justify-between items-start">
                <div className="flex-1 pr-6">
                  <p className="font-bold text-white text-base mb-1">{n.title}</p>
                  <p className="text-[var(--text2)] text-sm whitespace-pre-wrap leading-relaxed">{n.content}</p>
                  <p className="text-[var(--muted)] text-xs mt-3">{new Date(n.pushed_at).toLocaleTimeString()}</p>
                </div>
                <button onClick={() => downloadPDF(n)}
                  className="bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)] text-[var(--accent)] border border-indigo-500/20 px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5">
                  📥 Download PDF
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        receivedPDFs.length === 0 ? (
          <div className="text-center text-[var(--muted)] mt-12 flex-grow">
            <p className="text-5xl mb-2">📄</p>
            <p className="font-semibold text-[var(--muted)]">No PDF files shared by the teacher yet</p>
          </div>
        ) : (
          <div className="space-y-4 flex-grow">
            {receivedPDFs.map(pdf => (
              <div key={pdf.id} className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] flex justify-between items-center">
                <div className="flex-1 pr-6">
                  <p className="font-bold text-white text-base mb-1">{pdf.filename}</p>
                  <p className="text-[var(--muted)] text-xs mt-1">
                    Size: {Math.round(pdf.filesize / 1024)} KB · Shared: {new Date(pdf.pushed_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleViewPDF(pdf)}
                    className="bg-[var(--surface)] hover:bg-[var(--card2)] text-[var(--text2)] border border-[var(--border)] px-4 py-2 rounded-lg text-xs font-semibold transition-colors">
                    👁️ View PDF
                  </button>
                  <button onClick={() => handleDownloadPDF(pdf)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1">
                    📥 Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}

// ─── EXAM CLIENT ────────────────────────────────────────────
function ExamTab({ roomCode, socket, student, room, launchedExam }) {
  const [exam, setExam] = useState(null)
  const [answers, setAnswers] = useState({})
  const [timeLeft, setTimeLeft] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const timerRef = useRef(null)
  const latestRef = useRef({ exam, answers, submitted })
  const initializedExamRef = useRef(null)
  const submittingRef = useRef(false)
  latestRef.current = { exam, answers, submitted }

  useEffect(() => {
    loadActiveExam()
    const onLaunch = payload => {
      const launched = payload.exam || payload
      const id = launched.id || launched.exam_id
      if (Array.isArray(launched.questions)) initializeExam({ ...launched, id })
      else if (id) getExam(id).then(({ data }) => initializeExam({ ...data, id: data.id || id, questions: data.questions || [] })).catch(() => {})
    }
    if (launchedExam) onLaunch(launchedExam)
    socket.on('exam:launched', onLaunch)
    return () => { socket.off('exam:launched', onLaunch); clearInterval(timerRef.current) }
  }, [room?.id, launchedExam])

  async function loadActiveExam() {
    if (!room) return
    try {
      const { data: activeData } = await getAPI().get(`/exam/active/${encodeURIComponent(roomCode)}`)
      const activeExam = activeData.exam
      if (!activeExam) return
      const { data: historyData } = await getMyScores(student.id)
      const submission = (historyData.history || []).find(item => item.exam_id === activeExam.id)
      if (submission) { setSubmitted(true); setResult(submission); return }
      initializeExam(activeExam)
    } catch {}
  }

  function initializeExam(ex) {
    if (initializedExamRef.current === ex.id) return
    initializedExamRef.current = ex.id
    submittingRef.current = false
    latestRef.current = { exam: ex, answers: {}, submitted: false }
    setExam(ex); setSubmitted(false); setAnswers({}); setResult(null)
    const timestamp = ex.launched_at
    const normalized = timestamp && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(timestamp) ? timestamp.replace(' ', 'T') + 'Z' : timestamp
    const parsedStart = new Date(normalized).getTime()
    const start = Number.isFinite(parsedStart) ? parsedStart : Date.now()
    const deadline = start + Number(ex.duration_mins || 30) * 60 * 1000
    const remaining = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
    setTimeLeft(remaining()); clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const seconds = remaining(); setTimeLeft(seconds)
      if (seconds === 0) { clearInterval(timerRef.current); submitAnswers() }
    }, 1000)
  }

  function setAnswer(index, value) {
    if (submitted || submitting) return
    setAnswers(prev => { const next = { ...prev, [index]: value }; latestRef.current.answers = next; return next })
  }

  async function submitAnswers() {
    const current = latestRef.current
    if (!current.exam || current.submitted || submittingRef.current) return
    submittingRef.current = true; setSubmitting(true); clearInterval(timerRef.current)
    try {
      const { data } = await submitScore({ exam_id: current.exam.id, answers: current.answers })
      latestRef.current.submitted = true; setSubmitted(true); setResult(data)
    } catch (error) {
      submittingRef.current = false; setSubmitting(false)
      alert(error.response?.data?.error || 'Failed to submit exam.')
    }
  }

  function formatTime(sec) { const m = Math.floor(sec / 60); const s = sec % 60; return `${m}:${s < 10 ? '0' : ''}${s}` }

  if (submitted && result) {
    const pending = result.status === 'pending_review'
    return <div className="h-full flex items-center justify-center p-6"><div className="bg-[var(--card)] rounded-2xl p-8 border border-[var(--border)] max-w-md w-full text-center shadow-2xl"><p className="text-5xl mb-3">{pending ? '📝' : '✅'}</p><h3 className="text-xl font-bold text-[var(--text)] mb-2">{pending ? 'Answers submitted' : 'Exam graded'}</h3><p className="text-[var(--muted)] text-sm mb-6">{pending ? 'Written and code responses are waiting for your teacher to review.' : 'Your objective answers were graded by the server.'}</p>{!pending && <div className="bg-[var(--surface)] rounded-xl p-6 border border-[var(--border)] mb-6 grid grid-cols-2 gap-4"><div><p className="text-xs text-[var(--muted)] font-bold uppercase mb-1">Score</p><p className="text-2xl font-bold text-[var(--accent)]">{result.score} / {result.total}</p></div><div><p className="text-xs text-[var(--muted)] font-bold uppercase mb-1">Percentage</p><p className="text-2xl font-bold text-[var(--accent)]">{result.percentage}%</p></div></div>}{result.feedback && <p className="text-sm text-[var(--text2)] mb-4">Teacher feedback: {result.feedback}</p>}<button onClick={() => { setExam(null); setResult(null); setSubmitted(false); initializedExamRef.current = null }} className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl">Close</button></div></div>
  }
  if (!exam) return <div className="h-full flex items-center justify-center p-6 text-center text-[var(--muted)]"><div><p className="text-5xl mb-3">📝</p><p className="font-medium">No active exam running right now</p><p className="text-sm mt-1">When the teacher launches an assessment, it will load here.</p></div></div>
  return <div className="h-full flex flex-col"><div className="bg-[var(--card)] border-b border-[var(--border)] px-6 py-3 flex items-center justify-between flex-shrink-0"><div><h3 className="font-bold text-[var(--text)] text-base">{exam.title}</h3><p className="text-[var(--muted)] text-xs mt-1">{exam.questions?.length || 0} questions · mixed response</p></div><div className="flex items-center gap-3"><span className="text-xs text-[var(--muted)]">Time remaining:</span><span className="font-mono bg-[var(--red-soft)] text-[var(--red)] px-3 py-1.5 rounded-lg font-bold text-sm">⏳ {formatTime(timeLeft)}</span></div></div><div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-3xl mx-auto w-full">{exam.questions?.map((q, index) => <div key={index} className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)]"><p className="font-bold text-[var(--text)] text-sm mb-3">Q{index + 1}. {q.text} <span className="text-[var(--muted)] font-normal">({q.points || 1} pts · {q.type.replace('_', ' ')})</span></p>{q.type === 'mcq' ? <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{q.options?.map((option, oi) => <button key={oi} onClick={() => setAnswer(index, oi)} className={`text-left p-3.5 rounded-xl border text-sm ${answers[index] === oi ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--text)] font-medium' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text2)]'}`}><span className="inline-block w-6 h-6 rounded-lg bg-[var(--card)] text-center leading-6 text-xs text-[var(--muted)] font-bold mr-2.5">{String.fromCharCode(65 + oi)}</span>{option}</button>)}</div> : <textarea value={answers[index] || ''} onChange={e => setAnswer(index, e.target.value)} rows={q.type === 'long_answer' || q.type === 'code' ? 8 : 4} spellCheck={q.type !== 'code'} className={`w-full p-3 rounded-lg border border-[var(--border2)] bg-[var(--surface)] text-[var(--text)] ${q.type === 'code' ? 'font-mono bg-[#0d1117] text-[#e2e8f0]' : ''}`} placeholder={q.type === 'code' ? `Write your ${q.language || ''} solution...` : 'Write your answer...'} />}</div>)}<div className="pt-4 pb-12 flex justify-end"><button disabled={submitting} onClick={submitAnswers} className="bg-indigo-600 text-white font-bold px-8 py-3.5 rounded-xl disabled:opacity-50">{submitting ? 'Submitting…' : 'Submit assessment'}</button></div></div></div>
}
