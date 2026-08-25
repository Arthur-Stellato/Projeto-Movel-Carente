import { Routes, Route } from 'react-router-dom';

import PublicLayout from './components/layout/PublicLayout';
import AppShell from './components/layout/AppShell';
import { ProtectedRoute, AdminRoute } from './components/common/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/auth/Login';
import Registro from './pages/auth/Registro';
import VerificarEmail from './pages/auth/VerificarEmail';
import ItensListagem from './pages/itens/ItensListagem';
import ItemDetalhe from './pages/itens/ItemDetalhe';
import Dashboard from './pages/Dashboard';
import MeusItens from './pages/itens/MeusItens';
import SolicitacoesRecebidas from './pages/solicitacoes/SolicitacoesRecebidas';
import MinhasSolicitacoes from './pages/solicitacoes/MinhasSolicitacoes';
import Favoritos from './pages/Favoritos';
import Notificacoes from './pages/Notificacoes';
import Perfil from './pages/perfil/Perfil';
import Enderecos from './pages/perfil/Enderecos';
import MinhasDenuncias from './pages/denuncias/MinhasDenuncias';
import CategoriasAdmin from './pages/categorias/CategoriasAdmin';
import DenunciasAdmin from './pages/denuncias/DenunciasAdmin';
import AdminUsuarios from './pages/usuarios/AdminUsuarios';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      {/* Área pública — navbar simples, acessível sem login */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/itens" element={<ItensListagem />} />
        <Route path="/itens/:id" element={<ItemDetalhe />} />
      </Route>

      {/* Autenticação — tela cheia, sem navbar */}
      <Route path="/entrar" element={<Login />} />
      <Route path="/registrar" element={<Registro />} />
      <Route path="/verificar-email" element={<VerificarEmail />} />

      {/* Área logada — exige sessão ativa */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/painel" element={<Dashboard />} />
          <Route path="/painel/meus-itens" element={<MeusItens />} />
          <Route path="/painel/itens/:itemId/solicitacoes" element={<SolicitacoesRecebidas />} />
          <Route path="/painel/solicitacoes" element={<MinhasSolicitacoes />} />
          <Route path="/painel/favoritos" element={<Favoritos />} />
          <Route path="/painel/notificacoes" element={<Notificacoes />} />
          <Route path="/painel/denuncias" element={<MinhasDenuncias />} />
          <Route path="/painel/perfil" element={<Perfil />} />
          <Route path="/painel/perfil/enderecos" element={<Enderecos />} />

          {/* Somente admin */}
          <Route element={<AdminRoute />}>
            <Route path="/painel/admin/categorias" element={<CategoriasAdmin />} />
            <Route path="/painel/admin/denuncias" element={<DenunciasAdmin />} />
            <Route path="/painel/admin/usuarios" element={<AdminUsuarios />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
