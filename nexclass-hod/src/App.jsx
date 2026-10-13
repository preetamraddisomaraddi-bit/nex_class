import { BrowserRouter, Route, Routes } from 'react-router-dom'

function Placeholder() {
  return (
    <div style={{ padding: '40px', fontFamily: 'Plus Jakarta Sans' }}>
      <h1>NexClass HOD Portal</h1>
      <p>Setup complete. Ready to build.</p>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder />} />
      </Routes>
    </BrowserRouter>
  )
}
