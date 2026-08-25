import { useState } from 'react';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { authService } from '../../services/auth.service';
import { mensagemDeErro } from '../../services/api';

// emailInicial: quando já sabemos o email (ex: logo após o registro, na mesma
// tela) — nesse caso não mostramos o campo de email de novo, só o do código.
// Quando não vem (ex: alguém abre /verificar-email por conta própria depois),
// pedimos o email também, já que ele é necessário pra reenviar o código.
export default function VerificarEmailForm({ emailInicial, aoVerificado }) {
  const [email, setEmail] = useState(emailInicial || '');
  const [codigo, setCodigo] = useState('');
  const [verificando, setVerificando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [erro, setErro] = useState('');
  const [reenviado, setReenviado] = useState(false);

  async function verificar(evento) {
    evento.preventDefault();
    setErro('');
    setVerificando(true);
    try {
      await authService.verificarEmail(codigo.trim());
      aoVerificado?.(email);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setVerificando(false);
    }
  }

  async function reenviar() {
    if (!email) {
      setErro('Informe seu email pra reenviarmos o código.');
      return;
    }
    setErro('');
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
    <Form onSubmit={verificar}>
      {erro && <Alert variant="danger">{erro}</Alert>}
      {reenviado && (
        <Alert variant="success">
          <i className="bi bi-envelope-check me-1" /> Código reenviado — confira sua caixa de entrada.
        </Alert>
      )}

      {!emailInicial && (
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Form.Group>
      )}

      <Form.Group className="mb-3">
        <Form.Label>Código de verificação</Form.Label>
        <Form.Control
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Cole aqui o código que enviamos por email"
          required
          autoFocus
        />
        <Form.Text>O código vale por algumas horas — se não recebeu ou expirou, peça um novo abaixo.</Form.Text>
      </Form.Group>

      <Button type="submit" variant="primary" className="w-100 mb-2" disabled={verificando}>
        {verificando && <Spinner animation="border" size="sm" className="me-2" />}
        Verificar
      </Button>
      <Button type="button" variant="link" className="w-100" onClick={reenviar} disabled={reenviando}>
        {reenviando && <Spinner animation="border" size="sm" className="me-2" />}
        Reenviar código
      </Button>
    </Form>
  );
}
