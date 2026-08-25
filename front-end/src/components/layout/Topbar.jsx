import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import Dropdown from 'react-bootstrap/Dropdown';
import { useAuth } from '../../context/AuthContext';
import { notificacaoService } from '../../services/notificacao.service';

export default function Topbar({ aoAbrirMenu }) {
  const { usuario, logout } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      try {
        const contagem = await notificacaoService.contarNaoLidas();
        if (!cancelado) setNaoLidas(contagem);
      } catch {
        // silencioso — o sino simplesmente não mostra contagem
      }
    }
    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  return (
    <div className="mc-topbar d-flex align-items-center justify-content-between px-3 py-2">
      <Button variant="outline-secondary" size="sm" className="d-lg-none border-0" onClick={aoAbrirMenu} aria-label="Abrir menu">
        <i className="bi bi-list fs-4" />
      </Button>

      <div className="ms-auto d-flex align-items-center gap-3">
        <Link to="/painel/notificacoes" className="position-relative text-decoration-none" style={{ color: 'var(--mc-verde-900)' }}>
          <i className="bi bi-bell fs-5" />
          {naoLidas > 0 && (
            <span
              className="position-absolute translate-middle badge rounded-pill mc-dado"
              style={{ top: 2, left: '100%', background: 'var(--mc-tijolo-600)', fontSize: '0.62rem' }}
            >
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </Link>

        <Dropdown align="end">
          <Dropdown.Toggle as="button" className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2">
            <i className="bi bi-person-circle" />
            {usuario?.primeiroNome}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item as={Link} to="/painel/perfil">
              <i className="bi bi-gear me-2" /> Meu perfil
            </Dropdown.Item>
            <Dropdown.Divider />
            <Dropdown.Item onClick={logout} className="text-danger">
              <i className="bi bi-box-arrow-right me-2" /> Sair
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    </div>
  );
}
