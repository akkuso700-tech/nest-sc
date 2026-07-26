import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '../store/AuthContext.jsx'

function AdminRoute({ children }) {
  const { lang } = useParams()
  const location = useLocation()
  const { status, isAuthenticated, user } = useAuth()

  if (status === 'loading') {
    return null
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/${lang}/login`}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (user?.role !== 'admin') {
    return <Navigate to={`/${lang}/`} replace />
  }

  return children || <Outlet />
}

export default AdminRoute
