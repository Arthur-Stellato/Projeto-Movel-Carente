import { useState } from 'react';
import { Link } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import AuthLayout from './AuthLayout';
import { authService } from '../../services/auth.service';
import { mensagemDeErro } from '../../services/api';

export default function EsqueciSenha() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      // O backend sempre responde com a mesma mensagem genérica, exista ou
      // não o email — de propósito, pra não deixar alguém descobrir quais
      // emails têm conta só testando aqui. Por isso a tela também trata
      // sucesso e "email não encontrado" exatamente da mesma forma.
      await authService.esqueciSenha(email);
      setEnviado(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <AuthLayout titulo="Verifique seu email" subtitulo="Se esse email tiver uma conta, enviamos um código de recuperação.">
        <Alert variant="success" className="d-flex align-items-start gap-2">
          <i className="bi bi-envelope-check fs-5" />
          <span>
            Confira sua caixa de entrada (e o spam) pelo código, depois use o link abaixo pra definir a nova senha.
          </span>
        </Alert>
        <Button as={Link} to="/redefinir-senha" variant="primary" className="w-100 mt-2">
          Já tenho o código
        </Button>
        <p className="text-center mt-4 mb-0 small text-secondary">
          <Link to="/entrar">Voltar para o login</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Esqueceu sua senha?" subtitulo="Digite seu email e mandamos um código pra você redefinir.">
      {erro && <Alert variant="danger">{erro}</Alert>}
      <Form onSubmit={enviar}>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Form.Group>
        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={enviando}>
          {enviando && <Spinner animation="border" size="sm" className="me-2" />}
          Enviar código
        </Button>
      </Form>
      <p className="text-center mt-4 mb-0 small text-secondary">
        Já tem o código? <Link to="/redefinir-senha">Redefinir senha</Link>
        <br />
        <Link to="/entrar">Voltar para o login</Link>
      </p>
    </AuthLayout>
  );
}
