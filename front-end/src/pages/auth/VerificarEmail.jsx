import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import AuthLayout from './AuthLayout';
import VerificarEmailForm from '../../components/auth/VerificarEmailForm';
import { authService } from '../../services/auth.service';
import { mensagemDeErro } from '../../services/api';

export default function VerificarEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenQuery = searchParams.get('token');
  const emailQuery = searchParams.get('email');

  const [verificado, setVerificado] = useState(false);
  const [verificandoAutomatico, setVerificandoAutomatico] = useState(Boolean(tokenQuery));
  const [erroAutomatico, setErroAutomatico] = useState('');

  useEffect(() => {
    if (!tokenQuery) return;

    let ativo = true;

    async function validarTokenUrl() {
      try {
        await authService.verificarEmail(tokenQuery.trim());
        if (ativo) {
          setVerificado(true);
        }
      } catch (err) {
        if (ativo) {
          setErroAutomatico(mensagemDeErro(err));
        }
      } finally {
        if (ativo) {
          setVerificandoAutomatico(false);
        }
      }
    }

    validarTokenUrl();

    return () => {
      ativo = false;
    };
  }, [tokenQuery]);

  if (verificandoAutomatico) {
    return (
      <AuthLayout titulo="Verificando email..." subtitulo="Aguarde enquanto confirmamos sua conta.">
        <div className="text-center py-4">
          <Spinner animation="border" style={{ color: 'var(--mc-verde-800)' }} />
          <p className="text-secondary mt-3 mb-0">Validando link de confirmação...</p>
        </div>
      </AuthLayout>
    );
  }

  if (verificado) {
    return (
      <AuthLayout titulo="Email verificado!" subtitulo="Sua conta está ativa e pronta para uso.">
        <Alert variant="success" className="d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill fs-5" />
          <span>Sua conta foi confirmada com sucesso. Agora você já pode entrar.</span>
        </Alert>
        <Button variant="primary" className="w-100 mt-2" onClick={() => navigate('/entrar')}>
          Ir para o login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titulo="Verificar email"
      subtitulo="Use o código de 6 dígitos ou clique no link que enviamos por email para ativar sua conta."
    >
      {erroAutomatico && (
        <Alert variant="danger" className="mb-3">
          <i className="bi bi-exclamation-triangle-fill me-1" />
          {erroAutomatico}
        </Alert>
      )}
      <VerificarEmailForm
        emailInicial={emailQuery || ''}
        aoVerificado={() => setVerificado(true)}
      />
      <p className="text-center mt-4 mb-0 small text-secondary">
        <Link to="/entrar">Voltar para o login</Link>
      </p>
    </AuthLayout>
  );
}
