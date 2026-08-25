import { Link } from 'react-router-dom';
import Button from 'react-bootstrap/Button';

export default function NotFound() {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center text-center p-5" style={{ minHeight: '60vh' }}>
      <i className="bi bi-signpost-split" style={{ fontSize: '3rem', color: 'var(--mc-verde-700)' }} />
      <h2 className="mt-3">Página não encontrada</h2>
      <p className="text-secondary mb-4">O endereço que você tentou acessar não existe.</p>
      <Button as={Link} to="/" variant="primary">
        Voltar ao início
      </Button>
    </div>
  );
}
