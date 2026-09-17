import { Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/auth/Login'

// Stubs temporaires : à remplacer par les vraies pages quand on les construira.
function EntrepriseDashboardPlaceholder() {
  return <p style={{ padding: '2rem' }}>Dashboard entreprise (à venir)</p>
}

function MissionsPlaceholder() {
  return <p style={{ padding: '2rem' }}>Liste des missions (à venir)</p>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/entreprise/dashboard" element={<EntrepriseDashboardPlaceholder />} />
      <Route path="/missions" element={<MissionsPlaceholder />} />

      {/* Toute route inconnue renvoie vers /login pour l'instant */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
