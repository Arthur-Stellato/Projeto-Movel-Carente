import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import Button from 'react-bootstrap/Button';
import { Link, NavLink } from 'react-router-dom';
import BrandMark from '../common/BrandMark';
import { useAuth } from '../../context/AuthContext';

export default function PublicNavbar() {
  const { logado, usuario } = useAuth();

  return (
    <Navbar expand="md" className="mc-public-navbar py-3" variant="dark">
      <Container>
        <Navbar.Brand as={Link} to="/" className="mc-marca" style={{ color: '#fff' }}>
          <BrandMark />
          MóvelCarente
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="navbar-publica" />
        <Navbar.Collapse id="navbar-publica">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/itens">
              Buscar itens
            </Nav.Link>
          </Nav>
          <Nav className="align-items-md-center gap-2">
            {logado ? (
              <Button as={Link} to="/painel" variant="warning" size="sm">
                Olá, {usuario.primeiroNome} — ir ao painel
              </Button>
            ) : (
              <>
                <Nav.Link as={Link} to="/entrar">
                  Entrar
                </Nav.Link>
                <Button as={Link} to="/registrar" variant="warning" size="sm">
                  Quero doar ou pedir
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
