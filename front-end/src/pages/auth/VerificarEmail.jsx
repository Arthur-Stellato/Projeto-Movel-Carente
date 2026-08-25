import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import AuthLayout from './AuthLayout';
import VerificarEmailForm from '../../components/auth/VerificarEmailForm';

export default function VerificarEmail() {
  const navigate = useNavigate();
  const [verificado, setVerificado] = useState(false);

  if (verificado) {
    return (
      <AuthLayout titulo="Email verificado!">
        <Alert variant="success">
          <i className="bi bi-check-circle me-1" /> Sua conta foi confirmada. Já dá pra entrar.
        </Alert>
        <Button variant="primary" className="w-100" onClick={() => navigate('/entrar')}>
          Ir para o login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Verificar email" subtitulo="Cole o código que enviamos pra confirmar sua conta.">
      <VerificarEmailForm aoVerificado={() => setVerificado(true)} />
      <p className="text-center mt-4 mb-0 small text-secondary">
        <Link to="/entrar">Voltar para o login</Link>
      </p>
    </AuthLayout>
  );
}
