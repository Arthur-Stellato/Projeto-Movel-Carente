import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import AuthLayout from './AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { mensagemDeErro } from '../../services/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const localizacao = useLocation();
  const destino = localizacao.state?.de?.pathname || '/painel';

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');
  const [emailNaoVerificado, setEmailNaoVerificado] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [reenviado, setReenviado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEmailNaoVerificado(false);
    setReenviado(false);
    setEntrando(true);
    try {
      await login(email, senha);
      navigate(destino, { replace: true });
    } catch (err) {
      // O backend manda um `codigo` só nesse caso específico — checar por ele em
      // vez de comparar o texto da mensagem, que pode mudar sem quebrar o front.
      if (err.response?.data?.codigo === 'EMAIL_NAO_VERIFICADO') {
        setEmailNaoVerificado(true);
      }
      setErro(mensagemDeErro(err));
    } finally {
      setEntrando(false);
    }
  }

  async function reenviarVerificacao() {
    setReenviando(true);
    try {
      await authService.reenviarVerificacao(email);
      setReenviado(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setReenviando(false);
    }
  }

  return (
    <AuthLayout titulo="Bem-vindo de volta" subtitulo="Entre para doar ou pedir itens para sua casa.">
      {erro && (
        <Alert variant="danger">
          {erro}
          {emailNaoVerificado && !reenviado && (
            <div className="mt-2">
              <Button variant="outline-danger" size="sm" onClick={reenviarVerificacao} disabled={reenviando}>
                {reenviando && <Spinner animation="border" size="sm" className="me-2" />}
                Reenviar link de verificação
              </Button>
            </div>
          )}
          {reenviado && (
            <div className="mt-2 small">
              <i className="bi bi-envelope-check me-1" /> Link reenviado — confira sua caixa de entrada.
            </div>
          )}
        </Alert>
      )}
      <Form onSubmit={enviar}>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Senha</Form.Label>
          <Form.Control type="password" value={senha} onChange={(e) => setSenha(e.target.value)} required />
        </Form.Group>
        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={entrando}>
          {entrando && <Spinner animation="border" size="sm" className="me-2" />}
          Entrar
        </Button>
      </Form>
      <p className="text-center mt-4 mb-0 small text-secondary">
        Ainda não tem conta? <Link to="/registrar">Cadastre-se</Link>
      </p>
    </AuthLayout>
  );
}
