import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

export default function App() {
  const [pathname, setPathname] = useState(window.location.pathname)

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname)
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

  return pathname === '/admin' ? <Admin /> : <Dashboard />
}