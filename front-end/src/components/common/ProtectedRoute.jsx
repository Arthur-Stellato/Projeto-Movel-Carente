import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export function ProtectedRoute() {
  const { logado, carregando } = useAuth();
  const localizacao = useLocation();

  if (carregando) return <LoadingSpinner rotulo="Verificando sua sessão..." />;
  if (!logado) return <Navigate to="/entrar" state={{ de: localizacao }} replace />;
  return <Outlet />;
}

export function AdminRoute() {
  const { ehAdmin, carregando } = useAuth();

  if (carregando) return <LoadingSpinner rotulo="Verificando permissões..." />;
  if (!ehAdmin) return <Navigate to="/painel" replace />;
  return <Outlet />;
}
