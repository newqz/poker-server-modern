/**
 * 受保护路由组件
 * @component ProtectedRoute
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 */

import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store'
import { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore()
  const location = useLocation()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  return <>{children}</>
}
