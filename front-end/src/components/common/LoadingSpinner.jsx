import Spinner from 'react-bootstrap/Spinner';

export default function LoadingSpinner({ rotulo = 'Carregando...', tamanho, className = '' }) {
  return (
    <div className={`d-flex align-items-center justify-content-center gap-2 text-secondary py-4 ${className}`}>
      <Spinner animation="border" size={tamanho} style={{ color: 'var(--mc-verde-800)' }} />
      <span>{rotulo}</span>
    </div>
  );
}
