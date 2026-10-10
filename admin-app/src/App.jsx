import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Departments from './pages/Departments.jsx'
import Semesters from './pages/Semesters.jsx'
import Teachers from './pages/Teachers.jsx'
import Students from './pages/Students.jsx'
import Sessions from './pages/Sessions.jsx'
import Reports from './pages/Reports.jsx'
import Downloads from './pages/Downloads.jsx'
import { api } from './api.js'

function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState(null);

  useEffect(() => {
    async function fetchToken() {
      if (window.electronAPI) {
        const stored = await window.electronAPI.getToken();
        setToken(stored);
      }
      setChecking(false);
    }
    fetchToken();
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center font-bold text-slate-400 uppercase tracking-widest text-xs">
        Loading Session...
      </div>
    );
  }

  return token ? <AppShell>{children}</AppShell> : <Navigate to="/login" replace />;
}

function AppShell({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [university, setUniversity] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    loadUniversityData();
    loadPendingCount();
    const interval = setInterval(loadPendingCount, 15000); // refresh pending approvals count

    if (window.electronAPI) {
      window.electronAPI.onLogoutTriggered(handleLogout);
    }

    return () => clearInterval(interval);
  }, []);

  async function loadUniversityData() {
    if (window.electronAPI) {
      const stored = await window.electronAPI.getData('university');
      setUniversity(stored);
    }
  }

  async function loadPendingCount() {
    if (window.electronAPI) {
      const stored = await window.electronAPI.getData('university');
      if (stored) {
        try {
          const { data } = await api.get(`/universities/${stored.id}/alerts`);
          setPendingCount(data.pending_teachers?.length || 0);
        } catch (e) {}
      }
    }
  }

  async function handleLogout() {
    if (window.electronAPI) {
      await window.electronAPI.clearToken();
    }
    navigate('/login');
  }

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: '🏠' },
    { label: 'Departments', path: '/departments', icon: '🏢' },
    { label: 'Semesters', path: '/semesters', icon: '📅' },
    { label: 'Teachers', path: '/teachers', icon: '👨‍🏫', badge: pendingCount },
    { label: 'Students', path: '/students', icon: '👨‍🎓' },
    { label: 'Sessions', path: '/sessions', icon: '📋' },
    { label: 'Reports', path: '/reports', icon: '📊' },
    { label: 'Downloads', path: '/downloads', icon: '📥' }
  ];

  const getPageTitle = () => {
    const item = menuItems.find(m => location.pathname.startsWith(m.path));
    return item ? item.label : 'NexClass Admin';
  };

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden text-[#111827]">
      {/* Sidebar */}
      <aside className="w-[230px] bg-white border-r border-[#E4E7ED] flex flex-col justify-between select-none">
        <div>
          {/* Brand/University Section */}
          <div className="p-5 border-b border-[#E4E7ED]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#4F46E5] flex items-center justify-center text-white font-bold text-base">🎓</div>
              <div>
                <h1 className="font-extrabold text-[#111827] text-sm leading-none tracking-tight">NexClass</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Admin Desk</p>
              </div>
            </div>
            {university && (
              <div className="bg-[#EEF2FF] border border-[#D0D5DD] rounded-xl p-3">
                <p className="text-xs font-bold text-[#4F46E5] truncate">{university.name}</p>
                <span className="inline-block mt-1.5 font-mono text-[10px] font-extrabold bg-[#4F46E5] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                  {university.code}
                </span>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {menuItems.map(item => {
              const active = location.pathname.startsWith(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    active 
                      ? 'bg-[#EEF2FF] text-[#4F46E5]' 
                      : 'text-[#6B7280] hover:text-[#111827] hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm">{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                  {item.badge > 0 && (
                    <span className="bg-[#DC2626] text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Admin Section */}
        <div className="p-4 border-t border-[#E4E7ED] bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-[150px]">
            <div className="w-8 h-8 rounded-full bg-[#4F46E5] text-white flex items-center justify-center text-xs font-bold font-display select-none">
              {university ? university.admin_name?.slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="truncate">
              <p className="text-xs font-bold text-[#111827] truncate leading-none">{university ? university.admin_name : 'Administrator'}</p>
              <p className="text-[9px] text-[#6B7280] font-semibold uppercase mt-0.5">Uni Admin</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="text-slate-400 hover:text-red-650 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
            title="Sign Out"
          >
            ❌
          </button>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-[56px] bg-white border-b border-[#E4E7ED] px-8 flex items-center justify-between select-none">
          <h2 className="text-base font-extrabold text-[#111827] tracking-tight">{getPageTitle()}</h2>
          <div className="flex items-center gap-4">
            {university && (
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg">
                Connected to Code: <strong className="font-mono text-[#4F46E5]">{university.code}</strong>
              </span>
            )}
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Connected to cloud backend"></div>
          </div>
        </header>

        {/* Scrollable Page Wrapper */}
        <main className="flex-grow overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/departments" element={<ProtectedRoute><Departments /></ProtectedRoute>} />
        <Route path="/semesters" element={<ProtectedRoute><Semesters /></ProtectedRoute>} />
        <Route path="/teachers" element={<ProtectedRoute><Teachers /></ProtectedRoute>} />
        <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
        <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  )
}
