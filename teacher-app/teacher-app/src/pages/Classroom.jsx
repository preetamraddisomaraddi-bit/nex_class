import { useTheme } from '../context/ThemeContext.jsx'
import ThemeToggle from '../components/ThemeToggle.jsx'
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getRoomDetail, endRoom, createExam, getRoomExams, getExamScores, launchExam, gradeExamSubmission, getCodeSubmissions, reviewCodeSubmission, getAPI } from '../api.js'
import { useAuth } from '../context/AuthContext.jsx'
import {
  emitSessionCreated, emitSessionEnded, emitNotePushed,
  emitCodeBroadcast, emitBoardDraw,
  emitBoardClear, getSocket
} from '../socket.js'

const TABS = ['Board', 'Notes', 'Code', 'Attendance', 'Exam', 'Submissions']

export default function Classroom() {
  const { roomCode } = useParams()
  const navigate = useNavigate()
  const { teacher } = useAuth()
  const [room, setRoom] = useState(null)
  const [tab, setTab] = useState('Board')
  const [students, setStudents] = useState([])
  const socket = getSocket()

  // Screen share states & refs
  const [sharing, setSharing] = useState(false)
  const streamRef = useRef(null)
  const peersRef = useRef({}) // maps student socket.id -> RTCPeerConnection

  // Slide presentation states
  const [presenting, setPresenting] = useState(false)
  const [slides, setSlides] = useState([])
  const [slideIndex, setSlideIndex] = useState(0)
  const [presentingFilename, setPresentingFilename] = useState('')
  const [libreOfficeError, setLibreOfficeError] = useState('')

  // Handle new screen request from student
  async function handleScreenRequest({ from }) {
    if (!streamRef.current) return
    console.log(`[WebRTC] Received screen request from student socket: ${from}`)

    // Close existing connection if any
    if (peersRef.current[from]) {
      peersRef.current[from].close()
    }

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })
    peersRef.current[from] = pc

    pc.oniceconnectionstatechange = () => {
      console.log(`[WebRTC] ICE Connection State for ${from}:`, pc.iceConnectionState)
    }
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection State for ${from}:`, pc.connectionState)
    }

    // Add local screen tracks to this specific student's peer connection
    streamRef.current.getTracks().forEach(track => {
      pc.addTrack(track, streamRef.current)
    })

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('screen:ice-candidate', {
          room_code: roomCode,
          candidate: e.candidate,
          to: from
        })
      }
    }

    try {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      console.log(`[WebRTC] Emitting offer to student socket: ${from}`)
      socket.emit('screen:offer', {
        room_code: roomCode,
        offer,
        to: from
      })
    } catch (err) {
      console.error(`Error creating WebRTC offer for student ${from}:`, err)
    }
  }

  // Handle student answer
  async function handleScreenAnswer({ answer, from }) {
    const pc = peersRef.current[from]
    if (pc) {
      try {
        console.log(`[WebRTC] Received answer from student socket: ${from}`)
        await pc.setRemoteDescription(answer)
      } catch (err) {
        console.error(`Error setting remote answer for student ${from}:`, err)
      }
    }
  }

  // Handle ICE candidate from student
  async function handleScreenIceCandidate({ candidate, from }) {
    const pc = peersRef.current[from]
    if (pc && candidate) {
      try {
        await pc.addIceCandidate(candidate)
        console.log(`[WebRTC] Added ICE candidate from student socket: ${from}`)
      } catch (err) {
        console.error(`Error adding ICE candidate from student ${from}:`, err)
      }
    }
  }

  useEffect(() => {
    loadRoom()
    socket?.emit('room:join', { room_code: roomCode, user: { ...teacher, role: 'teacher' } })

    socket?.on('room:user_joined', ({ user, socketId }) => {
      if (user.role === 'student') {
        setStudents(prev => {
          if (prev.find(s => s.id === user.id)) return prev
          return [...prev, user]
        })
      }
    })

    socket?.on('room:user_left', ({ user, socketId }) => {
      if (socketId && peersRef.current[socketId]) {
        peersRef.current[socketId].close()
        delete peersRef.current[socketId]
      }
      setStudents(prev => prev.filter(s => s.id !== user.id))
    })

    socket?.on('screen:request', handleScreenRequest)
    socket?.on('screen:answer', handleScreenAnswer)
    socket?.on('screen:ice-candidate', handleScreenIceCandidate)

    const handleStudentJoined = data => setStudents(prev =>
      prev.some(student => student.id === data.student_id)
        ? prev
        : [...prev, { ...data, id: data.student_id }]
    )
    const handleStudentOffline = data => setStudents(prev =>
      prev.filter(student => student.id !== data.student_id)
    )
    socket?.on('student:joined', handleStudentJoined)
    socket?.on('student:offline', handleStudentOffline)

    // Distraction Filter status listener
    socket?.on('student:status-update', ({ student_id, socket_id, is_focused }) => {
      setStudents(prev => prev.map(s => {
        if (s.id === student_id) {
          return { ...s, socket_id, is_focused, last_seen: Date.now() };
        }
        return s;
      }));
    });

    socket?.on('student:force-close-alert', ({ student_name, timestamp }) => {
      alert(`🚨 WARNING: Student "${student_name}" exited Focus Mode (window closed) at ${new Date(timestamp).toLocaleTimeString()}!`);
    });

    // Roster status checker interval
    const interval = setInterval(() => {
      const now = Date.now();
      setStudents(prev => prev.map(s => {
        if (s.last_seen && now - s.last_seen > 8000) {
          return { ...s, is_focused: false }; // flag as distracted/offline
        }
        return s;
      }));
    }, 4000);

    const handleHodAlert = event => {
      const { message, type } = event.detail || {}
      alert(`📨 Message from HOD (${type || 'reminder'}): ${message || ''}`)
    }
    window.addEventListener('hod-alert', handleHodAlert)
    const handleApproval = event => alert(event.detail?.message || 'Your account has been approved by the HOD.')
    window.addEventListener('teacher-account-approved', handleApproval)

    return () => {
      socket.off('room:user_joined')
      socket.off('room:user_left')
      socket.off('screen:request')
      socket.off('screen:answer')
      socket.off('screen:ice-candidate')
      socket.off('student:status-update')
      socket.off('student:force-close-alert')
      socket?.off('student:joined', handleStudentJoined)
      socket?.off('student:offline', handleStudentOffline)
      clearInterval(interval)
      window.removeEventListener('hod-alert', handleHodAlert)
      window.removeEventListener('teacher-account-approved', handleApproval)
      stopScreenShare()
    }
  }, [])

  useEffect(() => {
    if (!room || !roomCode || !teacher) return
    emitSessionCreated({
      room_code: roomCode,
      subject: room.subject || teacher.subject,
      teacher_id: teacher.id,
      semester: room.semester || teacher.semester
    })
  }, [room, roomCode, teacher])

  async function loadRoom() {
    try {
      const { data } = await getRoomDetail(roomCode)
      const roomData = data.room || data
      setRoom(roomData)
      setStudents((roomData.attendance || []).map(record => ({
        ...record,
        id: record.student_id,
        is_focused: true
      })))
    } catch { navigate('/dashboard') }
  }

  async function endClass() {
    if (!confirm('End this class session?')) return
    stopScreenShare()
    try {
      await endRoom(roomCode)
      emitSessionEnded({ room_code: roomCode })
      socket?.emit('room:leave', { room_code: roomCode })
    } catch (error) {
      alert(error.response?.data?.error || 'Could not end this session.')
      return
    }
    navigate('/dashboard')
  }

  // PDF Push
  async function handlePushPDF() {
    try {
      const result = await window.electronAPI.selectPDF();
      if (!result) return;
      const { filename, filedata } = result;

      socket.emit('pdf:push', {
        room_code: roomCode,
        room_id: room.id,
        filename,
        filedata
      });
      alert(`Pushed PDF: "${filename}" to all students!`);
    } catch (err) {
      console.error('[PDF] Push error:', err);
      alert('Error pushing PDF file.');
    }
  }

  // Slide Presenter
  async function handlePresentFile() {
    try {
      const file = await window.electronAPI.selectPresenterFile();
      if (!file) return;

      const { filePath, filename, ext } = file;
      setPresentingFilename(filename);
      setLibreOfficeError('');

      let pdfBase64 = '';
      if (ext === '.pdf') {
        pdfBase64 = await window.electronAPI.readFileBuffer(filePath);
      } else if (ext === '.ppt' || ext === '.pptx') {
        const result = await window.electronAPI.convertPptToPdf(filePath);
        if (result.error) {
          setLibreOfficeError(result.error);
          return;
        }
        pdfBase64 = result.pdfData;
      } else {
        // Video file
        await startVideoFileShare(filePath);
        return;
      }

      if (pdfBase64) {
        await loadAndRenderSlides(pdfBase64);
      }
    } catch (err) {
      console.error('[Present] Error:', err);
      alert('Failed to present file.');
    }
  }

  // Load and render PDF pages dynamically using injected PDF.js
  async function loadAndRenderSlides(pdfBase64) {
    try {
      const pdfjsLib = await loadPdfJS();
      const pdfData = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
      const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
      const totalPages = pdf.numPages;
      const slideImages = [];

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        slideImages.push(canvas.toDataURL('image/jpeg', 0.85));
      }

      if (slideImages.length > 0) {
        setSlides(slideImages);
        setSlideIndex(0);
        setPresenting(true);
        socket.emit('slides:start', { room_code: roomCode, total_slides: slideImages.length });
        socket.emit('slides:page', { room_code: roomCode, page_index: 0, image: slideImages[0] });
      }
    } catch (err) {
      console.error('[Slides] PDF render error:', err);
      alert('Error extracting pages from PDF document.');
    }
  }

  function loadPdfJS() {
    return new Promise((resolve) => {
      if (window.pdfjsLib) return resolve(window.pdfjsLib);
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      document.body.appendChild(script);
    });
  }

  function handleNextSlide() {
    if (slideIndex < slides.length - 1) {
      const nextIndex = slideIndex + 1;
      setSlideIndex(nextIndex);
      socket.emit('slides:page', { room_code: roomCode, page_index: nextIndex, image: slides[nextIndex] });
    }
  }

  function handlePrevSlide() {
    if (slideIndex > 0) {
      const prevIndex = slideIndex - 1;
      setSlideIndex(prevIndex);
      socket.emit('slides:page', { room_code: roomCode, page_index: prevIndex, image: slides[prevIndex] });
    }
  }

  function handleStopPresentation() {
    setPresenting(false);
    setSlides([]);
    setSlideIndex(0);
    setPresentingFilename('');
    socket.emit('slides:end', { room_code: roomCode });
  }

  // Video File Presentation
  const videoElementRef = useRef(null);
  async function startVideoFileShare(filePath) {
    try {
      if (sharing) stopScreenShare();

      let video = videoElementRef.current;
      if (!video) {
        video = document.createElement('video');
        video.style.display = 'none';
        video.muted = true;
        video.playsInline = true;
        video.loop = true;
        document.body.appendChild(video);
        videoElementRef.current = video;
      }

      video.src = `local-media://${filePath}`;
      await video.play();

      const stream = video.captureStream ? video.captureStream() : video.mozCaptureStream();
      streamRef.current = stream;
      setSharing(true);

      socket.emit('screen:start', { room_code: roomCode });
    } catch (err) {
      console.error('[Video Share] Error:', err);
      alert('Error playing or sharing local video file.');
    }
  }

  // WebRTC Screen Share Host Functions
  async function startScreenShare() {
    if (sharing) {
      stopScreenShare()
      return
    }
    try {
      const sources = await window.electronAPI.getScreenSources()
      if (!sources || sources.length === 0) return alert('No display/window sources found.')

      // Auto-select primary screen/window
      const primary = sources.find(s => s.name.toLowerCase().includes('screen') || s.name.toLowerCase().includes('display')) || sources[0]

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: primary.id
          }
        }
      })

      console.log('[WebRTC] Screen captured successfully. Tracks:', stream.getVideoTracks().length)
      streamRef.current = stream
      setSharing(true)

      // Broadcast screen share start to all students in room
      socket.emit('screen:start', { room_code: roomCode })
    } catch (err) {
      console.error('Failed to capture screen:', err)
      alert('Error starting screen share: Permission denied or source unavailable.')
    }
  }

  function stopScreenShare() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    Object.entries(peersRef.current).forEach(([socketId, pc]) => {
      pc.close()
    })
    peersRef.current = {}
    setSharing(false)
    socket.emit('screen:stop', { room_code: roomCode })
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--bg)] text-white overflow-hidden relative">

      {/* LibreOffice install notice */}
      {libreOfficeError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-[var(--red-soft)] text-[var(--red)] border border-[var(--border)] rounded-xl px-6 py-4 shadow-xl z-50 max-w-lg text-center">
          <p className="font-bold text-sm mb-1">LibreOffice Required</p>
          <p className="text-xs text-[var(--text2)] leading-relaxed mb-3">
            PowerPoint conversion requires LibreOffice. Please download and install it, or select a PDF file instead.
          </p>
          <div className="flex justify-center gap-2">
            <button onClick={() => setLibreOfficeError('')} className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded">Close</button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="bg-[var(--card)] border-b border-[var(--border)] pl-6 pr-[140px] py-3 flex items-center justify-between drag-region flex-shrink-0">
        <div className="flex items-center gap-4 no-drag">
          <button onClick={() => navigate('/dashboard')} className="text-[var(--muted)] hover:text-[var(--text)] transition-colors">←</button>
          <div>
            <h1 className="font-bold text-white leading-none">{room?.subject} — {room?.class_name}</h1>
            <p className="text-xs text-[var(--muted)]">{room?.topic || 'No topic set'}</p>
          </div>
          <span className="font-mono bg-[var(--accent-soft)] text-[var(--accent)] px-3 py-1 rounded-lg text-sm font-bold border border-[var(--border)]">
            {roomCode}
          </span>
          <span className="text-xs text-[var(--green)] bg-[var(--green-soft)] px-2 py-1 rounded-full">
            🟢 {students.length} student{students.length !== 1 ? 's' : ''} joined
          </span>
        </div>
        <div className="flex items-center gap-2 no-drag">
          <ThemeToggle compact />
          <button onClick={handlePushPDF}
            className="text-sm px-3.5 py-2 rounded-lg bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] font-semibold transition-colors">
            📄 Push PDF
          </button>
          <button onClick={handlePresentFile}
            className="text-sm px-3.5 py-2 rounded-lg bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] font-semibold transition-colors">
            📽️ Present File
          </button>
          <button onClick={startScreenShare}
            className={`text-sm px-3.5 py-2 rounded-lg transition-colors border border-transparent font-semibold hover:bg-indigo-500
              ${sharing
                ? 'bg-[var(--red-soft)] text-[var(--red)] border-[var(--border)] hover:bg-[var(--red-soft)]'
                : 'bg-indigo-600 text-white'}`}>
            {sharing ? '🟥 Stop Share' : '🖥️ Share Screen'}
          </button>
          <button onClick={endClass} className="bg-[var(--red-soft)] hover:bg-[var(--red-soft)] text-[var(--red)] text-sm px-3.5 py-2 rounded-lg transition-colors border border-[var(--border)]">
            End Class
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="bg-[var(--card)] border-b border-[var(--border)] px-6 flex gap-1 flex-shrink-0">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px
              ${tab === t ? 'border-[var(--border)] text-[var(--accent)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--text)]'}`}>
            {t}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'Board' && (
          presenting ? (
            <div className="h-full flex flex-col bg-[var(--bg)] border border-[var(--border)] relative">
              <div className="bg-[var(--card)] border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"></span>
                  <p className="text-sm font-semibold text-white">Presenting: {presentingFilename}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={handlePrevSlide} disabled={slideIndex === 0}
                    className="bg-[var(--card2)] border border-[var(--border2)] hover:bg-[var(--card2)] disabled:opacity-30 disabled:hover:bg-[var(--card2)] text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                    ◀ Prev Slide
                  </button>
                  <span className="text-xs text-[var(--accent)] font-mono font-bold bg-[var(--accent-soft)] border border-[var(--border)] px-2.5 py-1 rounded">
                    Slide {slideIndex + 1} of {slides.length}
                  </span>
                  <button onClick={handleNextSlide} disabled={slideIndex === slides.length - 1}
                    className="bg-[var(--card2)] border border-[var(--border2)] hover:bg-[var(--card2)] disabled:opacity-30 disabled:hover:bg-[var(--card2)] text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                    Next Slide ▶
                  </button>
                  <button onClick={handleStopPresentation}
                    className="bg-[var(--red-soft)] hover:bg-[var(--red-soft)] text-[var(--red)] border border-[var(--border)] text-xs px-3 py-1.5 rounded-lg transition-colors font-medium">
                    Stop Presenting
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-black flex items-center justify-center p-4">
                <img src={slides[slideIndex]} className="max-w-full max-h-full object-contain shadow-2xl rounded-xl border border-slate-800" alt="slide" />
              </div>
            </div>
          ) : sharing ? (
            <div className="h-full flex flex-col items-center justify-center bg-[var(--bg)] text-[var(--muted)] p-6 text-center select-none">
              <span className="text-6xl mb-4">🖥️</span>
              <h3 className="text-xl font-bold text-white mb-2">Screen Share Active</h3>
              <p className="max-w-md text-sm text-[var(--muted)]">
                You are currently broadcasting your screen to all students. Whiteboard is hidden.
              </p>
            </div>
          ) : (
            <BoardTab roomCode={roomCode} socket={socket} />
          )
        )}
        {tab === 'Notes' && <NotesTab roomCode={roomCode} room={room} />}
        {tab === 'Code' && <CodeTab roomCode={roomCode} socket={socket} />}
        {tab === 'Attendance' && <AttendanceTab roomCode={roomCode} room={room} students={students} />}
        {tab === 'Exam' && <ExamTab roomCode={roomCode} room={room} socket={socket} />}
        {tab === 'Submissions' && <SubmissionsTab roomCode={roomCode} room={room} />}
      </div>
    </div>
  )
}

// ── BOARD TAB ──────────────────────────────────────────────
function BoardTab({ roomCode, socket }) {
  const { theme } = useTheme()
  const defaultInk = theme === 'dark' ? '#ffffff' : '#111827'
  const boardBackground = theme === 'dark' ? '#161B27' : '#FFFFFF'
  const strokes = useRef([])
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('default')
  const [size, setSize] = useState(3)
  const lastPos = useRef(null)
  const ctxRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    const ctx = canvas.getContext('2d')
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctxRef.current = ctx
  }, [])

  // Repaint only the local canvas palette; never emit clear events on theme changes.
  function paintStroke(stroke) {
    const ctx = ctxRef.current
    ctx.save()
    ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.color === 'default' ? defaultInk : stroke.color
    ctx.lineWidth = stroke.size
    ctx.beginPath()
    ctx.moveTo(stroke.from.x, stroke.from.y)
    ctx.lineTo(stroke.to.x, stroke.to.y)
    ctx.stroke()
    ctx.restore()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    if (!ctx || !canvas) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    strokes.current.forEach(paintStroke)
  }, [theme])

  function getPos(e) {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function startDraw(e) {
    setDrawing(true)
    lastPos.current = getPos(e)
  }

  function draw(e) {
    if (!drawing) return
    const pos = getPos(e)
    const stroke = { from: lastPos.current, to: pos, color, size: tool === 'eraser' ? 24 : size, erase: tool === 'eraser' }
    strokes.current.push(stroke)
    paintStroke(stroke)
    emitBoardDraw({
      room_code: roomCode,
      drawData: { from: lastPos.current, to: pos, color: tool === 'eraser' ? boardBackground : color === 'default' ? defaultInk : color, size: tool === 'eraser' ? 24 : size }
    })
    lastPos.current = pos
  }

  function stopDraw() { setDrawing(false); lastPos.current = null }

  function clearBoard() {
    strokes.current = []
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
    emitBoardClear({ room_code: roomCode })
  }

  const colors = ['default', '#f87171', '#fb923c', '#facc15', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6']

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="bg-[var(--card)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-4 flex-shrink-0">
        <div className="flex gap-2">
          {['pen', 'eraser'].map(t => (
            <button key={t} onClick={() => setTool(t)}
              className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors
                ${tool === t ? 'bg-indigo-600 text-white' : 'bg-[var(--card2)] text-[var(--text2)] hover:bg-[var(--card2)]'}`}>
              {t === 'pen' ? '✏️ Pen' : '🧹 Eraser'}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {colors.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('pen') }}
              className={`w-6 h-6 rounded-full border-2 transition-all ${color === c && tool === 'pen' ? 'border-[var(--accent)] scale-110' : 'border-transparent'}`}
              style={{ background: c === 'default' ? defaultInk : c }}
              title={c === 'default' ? 'Default pen (follows theme)' : c} aria-label={c === 'default' ? 'Default pen' : `Pen ${c}`} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--muted)]">Size</span>
          <input type="range" min="1" max="20" value={size} onChange={e => setSize(+e.target.value)} className="w-20" />
        </div>
        <button onClick={clearBoard} className="ml-auto bg-[var(--red-soft)] hover:bg-[var(--red-soft)] text-[var(--red)] px-3 py-1.5 rounded-lg text-sm transition-colors">
          Clear Board
        </button>
      </div>
      <canvas ref={canvasRef} className="flex-1 w-full cursor-crosshair bg-[var(--board-bg)]"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw} />
    </div>
  )
}

// ── NOTES TAB ──────────────────────────────────────────────
function NotesTab({ roomCode, room }) {
  const [notes, setNotes] = useState([])
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const socket = getSocket()

  useEffect(() => {
    if (room) setNotes(room.notes || [])
    const handleNote = note => {
      if (note.room_code !== roomCode) return
      setNotes(prev => prev.some(item => item.id === note.id) ? prev : [...prev, note])
    }
    socket?.on('note:received', handleNote)
    return () => socket?.off('note:received', handleNote)
  }, [room, roomCode, socket])

  async function pushNote() {
    if (!content.trim()) return
    const noteContent = title.trim() ? `${title.trim()}\n${content.trim()}` : content.trim()
    emitNotePushed({ room_code: roomCode, content: noteContent, pushed_at: new Date().toISOString() })
    setContent(''); setTitle('')
  }

  return (
    <div className="h-full flex gap-0 overflow-hidden">
      <div className="flex-1 p-6 overflow-y-auto">
        <h3 className="font-semibold text-white mb-4">Pushed Notes ({notes.length})</h3>
        {notes.length === 0 ? (
          <div className="text-center text-[var(--muted)] mt-12">
            <p className="text-4xl mb-2">📝</p>
            <p>No notes pushed yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="bg-[var(--card)] rounded-xl p-4 border border-[var(--border)]">
                <p className="font-medium text-white text-sm mb-1">{n.title || 'Class Note'}</p>
                <p className="text-[var(--text2)] text-sm whitespace-pre-wrap">{n.content}</p>
                <p className="text-[var(--muted)] text-xs mt-2">{new Date(n.pushed_at).toLocaleTimeString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="w-80 border-l border-[var(--border)] p-6 flex flex-col gap-4 bg-[var(--card)]">
        <h3 className="font-semibold text-white">Push Note to Students</h3>
        <input value={title} onChange={e => setTitle(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]"
          placeholder="Note title (optional)" />
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={8}
          className="bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)] resize-none"
          placeholder="Type your note here..." />
        <button onClick={pushNote} disabled={!content.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors">
          📤 Push to All Students
        </button>
      </div>
    </div>
  )
}

// ── CODE TAB ───────────────────────────────────────────────
function CodeTab({ roomCode, socket }) {
  const [code, setCode] = useState('# Write your code here\nprint("Hello, EduSync!")')
  const [language, setLanguage] = useState('python')
  const languages = ['python', 'javascript', 'java', 'c', 'cpp']

  function broadcast() {
    emitCodeBroadcast({ room_code: roomCode, code, language })
    alert('Code broadcast to all students!')
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-[var(--card)] border-b border-[var(--border)] px-4 py-2 flex items-center gap-4">
        <select value={language} onChange={e => setLanguage(e.target.value)}
          className="bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-1.5 text-sm text-white">
          {languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <button onClick={broadcast} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-1.5 rounded-lg transition-colors">
          📡 Broadcast to Students
        </button>
      </div>
      <textarea value={code} onChange={e => setCode(e.target.value)}
        className="flex-1 bg-[#0d1117] text-[#86efac] font-mono text-sm p-6 resize-none focus:outline-none"
        spellCheck={false} />
    </div>
  )
}

// ── ATTENDANCE TAB ─────────────────────────────────────────
function AttendanceTab({ roomCode, room, students }) {
  const [records, setRecords] = useState([])

  useEffect(() => { if (room) loadAttendance() }, [room, students])

  async function loadAttendance() {
    setRecords(room.attendance || [])
  }

  async function updateStatus(student_id, status) {
    alert(`Attendance is recorded when students join. Manual ${status} updates are not supported by the HOD server.`)
  }

  function exportCSV() {
    if (records.length === 0) return alert('No attendance records to export')

    const headers = ['Student Name', 'Roll Number', 'Class Section', 'Status', 'Joined Time']
    const rows = records.map(r => [
      r.name,
      r.usn || r.roll_no,
      r.class_section,
      r.status,
      r.joined_at ? new Date(r.joined_at).toLocaleString() : ''
    ])

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n')

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `Attendance_${room?.subject || 'Class'}_${roomCode}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const present = records.filter(r => r.status === 'present').length

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-white text-lg">Attendance</h3>
          <p className="text-[var(--muted)] text-sm">{present} / {records.length} present</p>
        </div>
        <button onClick={exportCSV}
          className="bg-[var(--accent-soft)] hover:bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--border)] text-sm px-4 py-2 rounded-lg transition-colors font-medium">
          📥 Export CSV
        </button>
      </div>
      {records.length === 0 ? (
        <div className="text-center text-[var(--muted)] mt-12">
          <p className="text-4xl mb-2">📋</p>
          <p>No students have joined yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map(r => {
            const joinedStud = students.find(s => s.id === r.student_id);
            const isOnline = !!joinedStud;
            const isFocused = joinedStud ? joinedStud.is_focused !== false : true;

            return (
              <div key={r.id} className="bg-[var(--card)] rounded-xl px-5 py-3 flex items-center justify-between border border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white avatar-ink"
                       style={{ background: r.avatar_color }}>
                      {r.name?.slice(0,1).toUpperCase()}
                    </div>
                    {/* Status Dot indicator */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--border)]
                      ${isOnline
                        ? (isFocused ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse')
                        : 'bg-red-500'}`}
                      title={isOnline ? (isFocused ? 'Online & Focused' : 'Distracted / Tab Exit') : 'Offline'}>
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-white text-sm">{r.name}</p>
                      {isOnline && !isFocused && (
                        <span className="text-[10px] bg-[var(--amber-soft)] text-[var(--amber)] border border-[var(--border)] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                          Distracted ⚠️
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--muted)] text-xs">USN: {r.usn || r.roll_no || '—'} · {r.status}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {['present', 'absent', 'late'].map(s => (
                    <button key={s} onClick={() => updateStatus(r.student_id, s)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors
                        ${r.status === s
                          ? s === 'present' ? 'bg-[var(--green-soft)] text-[var(--green)] border border-[var(--border)]'
                            : s === 'absent' ? 'bg-[var(--red-soft)] text-[var(--red)] border border-[var(--border)]'
                            : 'bg-[var(--amber-soft)] text-[var(--amber)] border border-[var(--border)]'
                          : 'bg-[var(--card2)] text-[var(--muted)] hover:bg-[var(--card2)]'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  )
}

// ── EXAM TAB ───────────────────────────────────────────────
function ExamTab({ roomCode, room, socket }) {
  const [exams, setExams] = useState([])
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [duration, setDuration] = useState(30)
  const [topic, setTopic] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [questions, setQuestions] = useState([{ type: 'mcq', text: '', points: 1, options: ['', '', '', ''], correct_index: 0 }])
  const [selectedResults, setSelectedResults] = useState(null)
  const [resultsList, setResultsList] = useState([])
  const [selectedSubmission, setSelectedSubmission] = useState(null)
  const [grades, setGrades] = useState({})
  const [overallFeedback, setOverallFeedback] = useState('')

  useEffect(() => { if (room?.id) loadExams() }, [room?.id])

  async function loadExams() {
    try {
      const { data } = await getRoomExams(room.id)
      setExams(data.exams || [])
    } catch { alert('Failed to load exams.') }
  }

  function addQuestion(type = 'mcq') {
    setQuestions(list => [...list, type === 'mcq'
      ? { type, text: '', points: 1, options: ['', '', '', ''], correct_index: 0 }
      : { type, text: '', points: type === 'long_answer' ? 5 : 2, rubric: '', language: 'javascript' }])
  }

  function updateQuestion(index, update) {
    setQuestions(list => list.map((q, i) => i === index ? { ...q, ...update } : q))
  }

  async function draftWithAI() {
    if (!topic.trim()) return alert('Enter a topic for the AI question draft.')
    setAiLoading(true)
    try {
      const { data } = await getAPI().post('/api/ai/generate-questions', {
        topic, subject: room?.subject, count: 4,
        types: ['mcq', 'short_answer', 'long_answer', 'code'], difficulty: 'medium'
      })
      setQuestions(data.questions || [])
    } catch (error) {
      alert(error.response?.data?.error || 'Could not draft questions. Check the server AI configuration.')
    } finally { setAiLoading(false) }
  }

  async function saveExam() {
    if (!title.trim() || questions.some(q => !q.text.trim())) return alert('Add an exam title and complete every question.')
    try {
      await createExam({ room_id: room.id, title, duration_mins: Number(duration), questions })
      setCreating(false); setTitle(''); setDuration(30); setTopic('')
      setQuestions([{ type: 'mcq', text: '', points: 1, options: ['', '', '', ''], correct_index: 0 }])
      await loadExams()
    } catch (error) { alert(error.response?.data?.error || 'Failed to create exam.') }
  }

  async function launch(exam) {
    try {
      await launchExam(exam.id)
      setExams(list => list.map(item => item.id === exam.id ? { ...item, status: 'active' } : item))
      alert(`Exam "${exam.title}" launched to students.`)
    } catch (error) { alert(error.response?.data?.error || 'Failed to launch exam.') }
  }

  async function viewResults(exam) {
    try {
      const { data } = await getExamScores(exam.id)
      setResultsList(data.results || [])
      setSelectedResults(exam)
      setSelectedSubmission(null)
    } catch (error) { alert(error.response?.data?.error || 'Failed to load exam submissions.') }
  }

  function exportExamResults() {
    if (!selectedResults || resultsList.length === 0) return alert('No results to export')
    const headers = ['Student Name', 'Roll Number', 'Score', 'Total Points', 'Percentage', 'Status', 'Submitted Time']
    const rows = resultsList.map(r => [r.name, r.usn || r.roll_no, r.score, r.total, r.percentage == null ? 'Pending review' : r.percentage + '%', r.status, r.submitted_at ? new Date(r.submitted_at).toLocaleString() : ''])
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const link = document.createElement('a'); link.href = encodeURI(csvContent); link.download = `Results_${selectedResults.title.replace(/\s+/g, '_')}.csv`; link.click()
  }

  async function saveGrade() {
    if (!selectedResults || !selectedSubmission) return
    try {
      const { data } = await gradeExamSubmission(selectedResults.id, selectedSubmission.id, { grades, feedback: overallFeedback })
      setResultsList(list => list.map(item => item.id === selectedSubmission.id ? { ...item, ...data } : item))
      setSelectedSubmission(null); setGrades({}); setOverallFeedback('')
    } catch (error) { alert(error.response?.data?.error || 'Failed to save grading.') }
  }

  const getQuestions = () => selectedResults?.questions || []
  const isManual = q => ['short_answer', 'long_answer', 'code'].includes(q.type)

  return (
    <div className="h-full overflow-y-auto p-6">
      {selectedResults ? (
        <div className="bg-[var(--card)] rounded-2xl p-6 border border-[var(--border)]">
          <div className="flex items-center justify-between mb-6">
            <div><button onClick={() => { setSelectedResults(null); setSelectedSubmission(null) }} className="text-sm text-[var(--accent)] mb-2 block">← Back to Exams</button><h3 className="font-bold text-[var(--text)] text-xl">{selectedResults.title} — Submissions</h3></div>
            <div className="flex gap-2"><button onClick={exportExamResults} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg">📥 Export CSV</button><button onClick={() => setSelectedResults(null)} className="bg-[var(--card2)] text-[var(--text)] text-sm px-4 py-2 rounded-lg">Close</button></div>
          </div>
          {selectedSubmission ? (
            <div className="space-y-4">
              <button onClick={() => setSelectedSubmission(null)} className="text-sm text-[var(--accent)]">← All submissions</button>
              <h4 className="font-semibold text-[var(--text)]">{selectedSubmission.name} · {selectedSubmission.usn || selectedSubmission.roll_no}</h4>
              {getQuestions().map((q, index) => isManual(q) && (
                <div key={index} className="rounded-xl p-4 border border-[var(--border)] bg-[var(--surface)]">
                  <p className="text-sm font-semibold text-[var(--text)]">Q{index + 1}. {q.text} <span className="text-[var(--muted)]">({q.points} pts)</span></p>
                  {q.type === 'code' ? <pre className="mt-3 p-3 bg-[#0d1117] text-[#e2e8f0] rounded-lg whitespace-pre-wrap overflow-x-auto">{selectedSubmission.answers?.[index] || 'No code submitted'}</pre> : <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--text2)]">{selectedSubmission.answers?.[index] || 'No answer submitted'}</p>}
                  <p className="mt-3 text-xs text-[var(--muted)]">Rubric: {q.rubric || 'Use your judgment against the question requirements.'}</p>
                  <div className="grid grid-cols-[110px_1fr] gap-3 mt-3"><label className="text-xs text-[var(--muted)]">Points earned</label><input type="number" min="0" max={q.points} step="0.5" value={grades[index]?.score ?? selectedSubmission.question_scores?.[index]?.score ?? ''} onChange={e => setGrades(prev => ({ ...prev, [index]: { ...prev[index], score: e.target.value } }))} className="bg-[var(--surface)] border border-[var(--border2)] text-[var(--text)] rounded px-3 py-2" /><label className="text-xs text-[var(--muted)]">Feedback</label><textarea value={grades[index]?.feedback ?? selectedSubmission.question_scores?.[index]?.feedback ?? ''} onChange={e => setGrades(prev => ({ ...prev, [index]: { ...prev[index], feedback: e.target.value, score: prev[index]?.score ?? selectedSubmission.question_scores?.[index]?.score } }))} className="bg-[var(--surface)] border border-[var(--border2)] text-[var(--text)] rounded px-3 py-2" rows="2" /></div>
                </div>
              ))}
              <label className="block text-sm text-[var(--text2)]">Overall feedback<textarea value={overallFeedback} onChange={e => setOverallFeedback(e.target.value)} className="block w-full mt-1 bg-[var(--surface)] border border-[var(--border2)] text-[var(--text)] rounded-lg p-3" rows="3" /></label>
              <button onClick={saveGrade} className="bg-indigo-600 text-white px-5 py-2 rounded-lg">Save grading</button>
            </div>
          ) : resultsList.length === 0 ? <p className="text-[var(--muted)] text-sm text-center py-8">No submissions yet.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead><tr className="border-b border-[var(--border)] text-xs font-semibold text-[var(--muted)] uppercase"><th className="py-3 px-4">Student</th><th className="py-3 px-4">Score</th><th className="py-3 px-4">Status</th><th className="py-3 px-4">Submitted</th><th className="py-3 px-4">Review</th></tr></thead><tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text2)]">{resultsList.map(r => <tr key={r.id}><td className="py-3 px-4">{r.name} · {r.usn || r.roll_no}</td><td className="py-3 px-4">{r.score} / {r.total}{r.percentage == null ? '' : ` (${r.percentage}%)`}</td><td className="py-3 px-4 capitalize">{r.status === 'pending_review' ? 'Pending review' : r.status}</td><td className="py-3 px-4">{new Date(r.submitted_at).toLocaleString()}</td><td className="py-3 px-4">{getQuestions().some(isManual) ? <button onClick={() => { setSelectedSubmission(r); setGrades(r.question_scores || {}); setOverallFeedback(r.feedback || '') }} className="text-[var(--accent)]">Review answers</button> : 'Auto-graded'}</td></tr>)}</tbody></table></div>
          )}
        </div>
      ) : <>
        <div className="flex items-center justify-between mb-6"><h3 className="font-semibold text-[var(--text)] text-lg">Exams</h3><button onClick={() => setCreating(true)} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg">+ Create Exam</button></div>
        {creating && <div className="bg-[var(--card)] rounded-2xl p-6 mb-6 border border-[var(--border)]">
          <h4 className="font-semibold text-[var(--text)] mb-4">New Exam</h4>
          <div className="grid grid-cols-2 gap-4 mb-4"><label className="text-xs text-[var(--muted)]">Exam title<input value={title} onChange={e => setTitle(e.target.value)} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)]" placeholder="Mid-term assessment" /></label><label className="text-xs text-[var(--muted)]">Duration (minutes)<input type="number" min="1" max="300" value={duration} onChange={e => setDuration(+e.target.value)} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)]" /></label></div>
          <div className="rounded-lg bg-[var(--card2)] p-3 mb-4"><label className="text-xs text-[var(--muted)]">AI question draft topic<input value={topic} onChange={e => setTopic(e.target.value)} className="w-full mt-1 bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)]" placeholder="e.g. SQL joins and normalization" /></label><button disabled={aiLoading} onClick={draftWithAI} className="mt-2 text-sm text-[var(--accent)] disabled:opacity-50">{aiLoading ? 'Drafting…' : '✨ Draft questions with AI'}</button><p className="text-xs text-[var(--muted)] mt-1">Review and edit every draft before saving. Configure GEMINI_API_KEY on the server. Free-tier prompts may be used to improve Google products; omit student data.</p></div>
          <div className="space-y-4 mb-4">{questions.map((q, qi) => <div key={qi} className="bg-[var(--bg)] rounded-xl p-4 border border-[var(--border)]"><div className="flex justify-between gap-3 mb-2"><p className="text-xs text-[var(--muted)]">Question {qi + 1}</p><button onClick={() => setQuestions(list => list.filter((_, i) => i !== qi))} className="text-xs text-[var(--red)]">Remove</button></div><div className="grid grid-cols-[1fr_100px] gap-2"><select value={q.type} onChange={e => { const type=e.target.value; updateQuestion(qi, type === 'mcq' ? { type, options: ['', '', '', ''], correct_index: 0 } : { type, rubric: q.rubric || '', language: q.language || 'javascript' }) }} className="bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)]"><option value="mcq">Multiple choice</option><option value="short_answer">Short answer</option><option value="long_answer">Long answer</option><option value="code">Code response</option></select><input type="number" min="0.5" step="0.5" value={q.points} onChange={e => updateQuestion(qi, { points: Number(e.target.value) })} className="bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)]" aria-label="Question points" /></div><textarea value={q.text} onChange={e => updateQuestion(qi, { text: e.target.value })} className="w-full mt-2 bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)]" rows="2" placeholder="Question text" />{q.type === 'mcq' ? <div className="grid grid-cols-2 gap-2 mt-2">{(q.options || []).map((option, oi) => <div key={oi} className="flex items-center gap-2"><input type="radio" name={`correct-${qi}`} checked={q.correct_index === oi} onChange={() => updateQuestion(qi, { correct_index: oi })} /><input value={option} onChange={e => updateQuestion(qi, { options: q.options.map((item, i) => i === oi ? e.target.value : item) })} className="w-full bg-[var(--surface)] border border-[var(--border2)] rounded px-2 py-1.5 text-sm text-[var(--text)]" placeholder={`Option ${oi + 1}`} /></div>)}</div> : <><textarea value={q.rubric || ''} onChange={e => updateQuestion(qi, { rubric: e.target.value })} className="w-full mt-2 bg-[var(--surface)] border border-[var(--border2)] rounded-lg px-3 py-2 text-sm text-[var(--text)]" rows="2" placeholder="Teacher rubric / expected points" />{q.type === 'code' && <input value={q.language || 'javascript'} onChange={e => updateQuestion(qi, { language: e.target.value })} className="mt-2 bg-[var(--surface)] border border-[var(--border2)] rounded px-3 py-2 text-sm text-[var(--text)]" placeholder="Programming language" />}</>}</div>)}</div>
          <div className="flex flex-wrap gap-2"><button onClick={() => addQuestion('mcq')} className="bg-[var(--card2)] text-[var(--text)] text-sm px-3 py-2 rounded-lg">+ MCQ</button><button onClick={() => addQuestion('short_answer')} className="bg-[var(--card2)] text-[var(--text)] text-sm px-3 py-2 rounded-lg">+ Short answer</button><button onClick={() => addQuestion('long_answer')} className="bg-[var(--card2)] text-[var(--text)] text-sm px-3 py-2 rounded-lg">+ Long answer</button><button onClick={() => addQuestion('code')} className="bg-[var(--card2)] text-[var(--text)] text-sm px-3 py-2 rounded-lg">+ Code</button><button onClick={saveExam} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg">Save Exam</button><button onClick={() => setCreating(false)} className="text-[var(--muted)] text-sm px-4 py-2">Cancel</button></div>
        </div>}
        <div className="space-y-3">{exams.map(exam => <div key={exam.id} className="bg-[var(--card)] rounded-xl p-5 border border-[var(--border)] flex items-center justify-between"><div><p className="font-semibold text-[var(--text)]">{exam.title}</p><p className="text-[var(--muted)] text-sm">{exam.questions?.length || 0} questions · {exam.duration_mins} mins</p></div><div className="flex items-center gap-3"><span className="px-3 py-1 rounded-full text-xs uppercase">{exam.status}</span>{exam.status === 'draft' && <button onClick={() => launch(exam)} className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-lg">🚀 Launch</button>}<button onClick={() => viewResults(exam)} className="text-[var(--accent)] text-sm px-3 py-1.5">📊 Submissions</button></div></div>)}{!exams.length && !creating && <div className="text-center text-[var(--muted)] mt-12"><p className="text-4xl mb-2">📝</p><p>No exams created yet</p></div>}</div>
      </>}
    </div>
  )
}

// ── SUBMISSIONS TAB ────────────────────────────────────────
function SubmissionsTab({ roomCode, room }) {
  const [submissions, setSubmissions] = useState([])
  const [selected, setSelected] = useState(null)
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const socket = getSocket()

  useEffect(() => {
    if (!room) return
    getCodeSubmissions(room.id).then(({ data }) => setSubmissions(data.submissions || []))
      .catch(() => {})
    const addSubmission = submission => {
      if (submission.room_code !== roomCode) return
      const item = {
        ...submission,
        id: submission.id || `${submission.student_id}-${submission.submitted_at || Date.now()}`,
        name: submission.name || submission.student_name || `Student ${submission.student_id || ''}`,
        submitted_at: submission.submitted_at || new Date().toISOString()
      }
      setSubmissions(prev => prev.some(existing => existing.id === item.id) ? prev : [item, ...prev])
    }
    socket?.on('code:submission', addSubmission)
    socket?.on('exam:submission', addSubmission)
    return () => {
      socket?.off('code:submission', addSubmission)
      socket?.off('exam:submission', addSubmission)
    }
  }, [room, roomCode, socket])

  async function saveCodeReview() {
    if (!selected) return
    setSavingReview(true)
    try {
      const { data } = await reviewCodeSubmission(selected.id, { grade, feedback })
      const updated = { ...selected, ...data }
      setSelected(updated)
      setSubmissions(prev => prev.map(item => item.id === updated.id ? updated : item))
    } catch (error) { alert(error.response?.data?.error || 'Failed to save code review.') }
    finally { setSavingReview(false) }
  }

  return (
    <div className="h-full flex overflow-hidden">
      <div className="w-72 border-r border-[var(--border)] overflow-y-auto p-4">
        <h3 className="font-semibold text-white mb-3 text-sm">Live Submissions ({submissions.length})</h3>
        {submissions.length === 0 ? (
          <p className="text-[var(--muted)] text-sm text-center mt-8">No submissions yet</p>
        ) : (
          <div className="space-y-2">
            {submissions.map(s => (
              <button key={s.id} onClick={() => setSelected(s)}
                className={`w-full text-left p-3 rounded-xl transition-colors border
                  ${selected?.id === s.id ? 'bg-[var(--accent-soft)] border-[var(--border)]' : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--border2)]'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white avatar-ink" style={{ background: s.avatar_color }}>
                    {s.name?.slice(0,1)}
                  </div>
                  <p className="font-medium text-white text-sm">{s.name}</p>
                </div>
                <p className="text-[var(--muted)] text-xs">{s.language || 'Code'} · {s.status || 'submitted'} · {new Date(s.submitted_at).toLocaleTimeString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        {selected ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white avatar-ink" style={{ background: selected.avatar_color }}>
                {selected.name?.slice(0,1)}
              </div>
              <div>
                <p className="font-semibold text-white">{selected.name} — USN: {selected.usn || selected.roll_no || '—'}</p>
                <p className="text-[var(--muted)] text-sm">{selected.language} · {new Date(selected.submitted_at).toLocaleString()}</p>
              </div>
            </div>
            <pre className="bg-[#0d1117] text-[#86efac] font-mono text-sm p-4 rounded-xl overflow-x-auto border border-[var(--border)]">{selected.code}</pre>
            {selected.output && (
              <div className="mt-4">
                <p className="text-xs text-[var(--muted)] mb-2 uppercase tracking-wider">Output</p>
                <pre className="bg-[#0d1117] text-[#e2e8f0] font-mono text-sm p-4 rounded-xl border border-[var(--border)]">{selected.output}</pre>
              </div>
            )}
            <div className="mt-5 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 space-y-3">
              <h4 className="font-semibold text-[var(--text)]">Teacher review</h4>
              {selected.grade != null && <p className="text-sm text-[var(--text2)]">Current grade: {selected.grade}/100 · {selected.status}</p>}
              <label className="block text-xs text-[var(--muted)]">Grade (0–100)<input type="number" min="0" max="100" value={grade} onChange={e => setGrade(e.target.value)} className="block mt-1 w-32 rounded border border-[var(--border2)] bg-[var(--surface)] p-2 text-sm text-[var(--text)]" /></label>
              <label className="block text-xs text-[var(--muted)]">Feedback<textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows="3" className="block mt-1 w-full rounded border border-[var(--border2)] bg-[var(--surface)] p-2 text-sm text-[var(--text)]" /></label>
              <button disabled={savingReview} onClick={saveCodeReview} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{savingReview ? 'Saving…' : 'Save review'}</button>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-[var(--muted)]">
            <div className="text-center">
              <p className="text-4xl mb-2">👈</p>
              <p>Select a submission to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

