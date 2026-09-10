import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import AuthLayout from './AuthLayout';
import { authService } from '../../services/auth.service';
import { mensagemDeErro } from '../../services/api';

export default function RedefinirSenha() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // O email de recuperação manda o código como texto pra copiar, não um link
  // clicável (diferente da verificação de email) — por isso o campo fica
  // editável. Se um dia isso mudar pra um link com ?token=..., já funciona
  // sem precisar tocar nesta tela.
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');

    if (novaSenha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    setEnviando(true);
    try {
      await authService.redefinirSenha(token.trim(), novaSenha);
      setSucesso(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <AuthLayout titulo="Senha redefinida!" subtitulo="Já pode entrar com a nova senha.">
        <Alert variant="success" className="d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill fs-5" />
          <span>Tudo certo — sua senha foi alterada.</span>
        </Alert>
        <Button variant="primary" className="w-100 mt-2" onClick={() => navigate('/entrar', { replace: true })}>
          Ir para o login
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Redefinir senha" subtitulo="Cole o código que enviamos por email e escolha a nova senha.">
      {erro && <Alert variant="danger">{erro}</Alert>}
      <Form onSubmit={enviar}>
        <Form.Group className="mb-3">
          <Form.Label>Código de recuperação</Form.Label>
          <Form.Control value={token} onChange={(e) => setToken(e.target.value)} required autoFocus />
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Nova senha</Form.Label>
          <Form.Control type="password" value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} required />
          <Form.Text>Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.</Form.Text>
        </Form.Group>
        <Form.Group className="mb-3">
          <Form.Label>Confirmar nova senha</Form.Label>
          <Form.Control
            type="password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            isInvalid={confirmarSenha.length > 0 && confirmarSenha !== novaSenha}
            required
          />
          <Form.Control.Feedback type="invalid">As senhas não coincidem.</Form.Control.Feedback>
        </Form.Group>
        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={enviando}>
          {enviando && <Spinner animation="border" size="sm" className="me-2" />}
          Redefinir senha
        </Button>
      </Form>
      <p className="text-center mt-4 mb-0 small text-secondary">
        Não recebeu o código? <Link to="/esqueci-senha">Pedir de novo</Link>
        <br />
        <Link to="/entrar">Voltar para o login</Link>
      </p>
    </AuthLayout>
  );
}
