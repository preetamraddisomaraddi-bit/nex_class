import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing.jsx'
import Register from './pages/Register.jsx'

export default function App() {
  return (
    <BrowserRouter basename="/register">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signup" element={<Register />} />
      </Routes>
    </BrowserRouter>
  )
}
