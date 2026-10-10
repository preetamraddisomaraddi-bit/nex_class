import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between select-none">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-lg shadow-md text-white font-bold">🎓</div>
          <div>
            <h1 className="font-bold text-slate-900 leading-none">NexClass</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Multi-University Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a href="#features" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Features</a>
          <button onClick={() => navigate('/signup')} 
            className="bg-indigo-600 hover:bg-indigo-750 text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-indigo-600/10">
            Register Institution
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 py-16 px-8 max-w-6xl mx-auto flex flex-col items-center justify-center text-center">
        <span className="text-xs bg-indigo-50 text-indigo-750 border border-indigo-100 font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-6 animate-pulse">
          Now Supporting Multi-Tenant SaaS
        </span>
        <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 tracking-tight leading-none max-w-4xl">
          NexClass for Universities
        </h2>
        <p className="text-lg md:text-xl text-slate-500 mt-6 max-w-2xl font-medium">
          Live whiteboard synchronization, real-time cooperative code editors, smart auto-graded exam systems, and automated kiosk focus tracking — all unified under a single institution code.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <button onClick={() => navigate('/signup')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8 py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 text-sm flex items-center gap-2">
            Register Your University <span className="text-lg">→</span>
          </button>
          <a href="/register/admin-app.zip" download
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold px-8 py-4 rounded-xl transition-all border border-slate-200 text-sm flex items-center justify-center gap-2 shadow-sm">
            📥 Download Admin App
          </a>
        </div>

        {/* Features Highlight */}
        <section id="features" className="mt-20 w-full pt-10 border-t border-slate-200">
          <h3 className="text-xs font-bold text-indigo-650 uppercase tracking-widest mb-12">Integrated Platform Features</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: '🖊️', title: 'Live Whiteboard Sync', desc: 'Sync vector pen coordinate details instantly between teachers and student canvas layers.' },
              { icon: '💻', title: 'Real-time Code Editor', desc: 'Cooperative multi-language programming workspaces integrated with Claude AI assistants.' },
              { icon: '📝', title: 'Smart Exam System', desc: 'Execute live MCQ quizzes with auto-submit timers, locks, and instant results exports.' },
              { icon: '🤖', title: 'AI-Powered Hints', desc: 'Syntax evaluation fallback systems and intelligent feedback prompts for classrooms.' }
            ].map(f => (
              <div key={f.title} className="bg-white border border-slate-200/80 rounded-2xl p-6 text-left shadow-sm hover:shadow-md transition-all duration-300">
                <span className="text-3xl mb-4 block select-none">{f.icon}</span>
                <h4 className="font-bold text-slate-900 text-base leading-snug">{f.title}</h4>
                <p className="text-slate-500 text-xs mt-2 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400 font-medium">
        <p>&copy; {new Date().getFullYear()} NexClass SaaS Inc. All rights reserved.</p>
      </footer>
    </div>
  )
}
