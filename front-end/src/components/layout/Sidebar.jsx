import Nav from 'react-bootstrap/Nav';
import { NavLink } from 'react-router-dom';
import BrandMark from '../common/BrandMark';
import { useAuth } from '../../context/AuthContext';

const ITENS_NAV = [
  { to: '/painel', rotulo: 'Painel', icone: 'bi-speedometer2', fim: true },
  { to: '/itens', rotulo: 'Buscar itens', icone: 'bi-search' },
  { to: '/painel/meus-itens', rotulo: 'Meus itens', icone: 'bi-box-seam' },
  { to: '/painel/solicitacoes', rotulo: 'Minhas solicitações', icone: 'bi-hand-index-thumb' },
  { to: '/painel/conversas', rotulo: 'Conversas & Chat', icone: 'bi-chat-dots' },
  { to: '/painel/favoritos', rotulo: 'Favoritos', icone: 'bi-heart' },
  { to: '/painel/notificacoes', rotulo: 'Notificações', icone: 'bi-bell' },
  { to: '/painel/denuncias', rotulo: 'Minhas denúncias', icone: 'bi-flag' },
  { to: '/painel/perfil', rotulo: 'Meu perfil', icone: 'bi-person-circle' },
];

const ITENS_ADMIN = [
  { to: '/painel/admin/categorias', rotulo: 'Categorias', icone: 'bi-tags' },
  { to: '/painel/admin/denuncias', rotulo: 'Denúncias (todas)', icone: 'bi-shield-exclamation' },
  { to: '/painel/admin/usuarios', rotulo: 'Usuários', icone: 'bi-people' },
];

export default function Sidebar({ aoNavegar }) {
  const { ehAdmin } = useAuth();

  return (
    <div className="mc-sidebar d-flex flex-column p-3">
      <NavLink to="/painel" className="mc-marca mc-marca mb-4" onClick={aoNavegar}>
        <BrandMark />
        MóvelCarente
      </NavLink>

      <Nav className="flex-column gap-1">
        {ITENS_NAV.map((item) => (
          <Nav.Link key={item.to} as={NavLink} to={item.to} end={item.fim} onClick={aoNavegar}>
            <i className={`bi ${item.icone}`} /> {item.rotulo}
          </Nav.Link>
        ))}
      </Nav>

      {ehAdmin && (
        <>
          <div className="text-uppercase small mt-4 mb-1 px-2" style={{ color: 'rgba(238,244,240,0.5)', letterSpacing: '0.05em', fontSize: '0.72rem' }}>
            Administração
          </div>
          <Nav className="flex-column gap-1">
            {ITENS_ADMIN.map((item) => (
              <Nav.Link key={item.to} as={NavLink} to={item.to} onClick={aoNavegar}>
                <i className={`bi ${item.icone}`} /> {item.rotulo}
              </Nav.Link>
            ))}
          </Nav>
        </>
      )}
    </div>
  );
}
