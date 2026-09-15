import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import { useReenviarVerificacao } from '../../hooks/useReenviarVerificacao';

// Mesmo formato do <Alert variant="danger">{erro}</Alert> que já existia em
// ItemFormModal e AvaliacaoModal — só acrescenta o botão quando o erro for,
// especificamente, falta de verificação de email.
export default function ErroComReenvio({ erro, precisaVerificarEmail }) {
  const reenviar = useReenviarVerificacao();

  if (!erro) return null;

  return (
    <Alert variant="danger" className="d-flex justify-content-between align-items-center gap-2">
      <span>{erro}</span>
      {precisaVerificarEmail && (
        <Button variant="outline-danger" size="sm" className="flex-shrink-0" onClick={reenviar}>
          Reenviar verificação
        </Button>
      )}
    </Alert>
  );
}
