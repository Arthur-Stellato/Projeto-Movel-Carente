import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import AuthLayout from './AuthLayout';
import VerificarEmailForm from '../../components/auth/VerificarEmailForm';
import { useAuth } from '../../context/AuthContext';
import { mensagemDeErro } from '../../services/api';

const VAZIO = { primeiroNome: '', ultimoNome: '', email: '', cpf: '', telefone: '', senha: '' };

export default function Registro() {
  const { registrar, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(VAZIO);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);
  const [entrandoAutomaticamente, setEntrandoAutomaticamente] = useState(false);

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await registrar({ ...form, telefone: form.telefone || undefined });
      setSucesso(true);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  // Depois de verificar o código, já aproveitamos a senha que a pessoa acabou
  // de digitar nesta mesma tela pra logar direto — sem isso ela verificaria o
  // email e ainda precisaria voltar pro login e digitar tudo de novo.
  async function aoVerificarComSucesso() {
    setEntrandoAutomaticamente(true);
    try {
      await login(form.email, form.senha);
      navigate('/painel', { replace: true });
    } catch {
      // Se por algum motivo o login automático falhar, não travamos a pessoa
      // aqui — ela já está verificada, só manda pro login pra entrar na mão.
      navigate('/entrar', { replace: true });
    }
  }

  if (sucesso) {
    return (
      <AuthLayout titulo="Quase lá!" subtitulo={`Enviamos um código de verificação para ${form.email}.`}>
        {entrandoAutomaticamente ? (
          <div className="text-center py-3">
            <Spinner animation="border" style={{ color: 'var(--mc-verde-800)' }} />
            <p className="text-secondary mt-3 mb-0">Entrando...</p>
          </div>
        ) : (
          <VerificarEmailForm emailInicial={form.email} aoVerificado={aoVerificarComSucesso} />
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout titulo="Criar conta" subtitulo="Leva menos de um minuto.">
      {erro && <Alert variant="danger">{erro}</Alert>}
      <Form onSubmit={enviar}>
        <Row>
          <Col md={6} className="mb-3">
            <Form.Label>Primeiro nome</Form.Label>
            <Form.Control value={form.primeiroNome} maxLength={100} onChange={(e) => atualizarCampo('primeiroNome', e.target.value)} required />
          </Col>
          <Col md={6} className="mb-3">
            <Form.Label>Último nome</Form.Label>
            <Form.Control value={form.ultimoNome} maxLength={100} onChange={(e) => atualizarCampo('ultimoNome', e.target.value)} required />
          </Col>
        </Row>
        <Form.Group className="mb-3">
          <Form.Label>Email</Form.Label>
          <Form.Control type="email" value={form.email} onChange={(e) => atualizarCampo('email', e.target.value)} required />
        </Form.Group>
        <Row>
          <Col md={6} className="mb-3">
            <Form.Label>CPF</Form.Label>
            <Form.Control value={form.cpf} placeholder="000.000.000-00" onChange={(e) => atualizarCampo('cpf', e.target.value)} required />
          </Col>
          <Col md={6} className="mb-3">
            <Form.Label>Telefone (opcional)</Form.Label>
            <Form.Control value={form.telefone} placeholder="(00) 00000-0000" onChange={(e) => atualizarCampo('telefone', e.target.value)} />
          </Col>
        </Row>
        <Form.Group className="mb-3">
          <Form.Label>Senha</Form.Label>
          <Form.Control type="password" value={form.senha} onChange={(e) => atualizarCampo('senha', e.target.value)} required />
          <Form.Text>Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.</Form.Text>
        </Form.Group>
        <Button type="submit" variant="primary" className="w-100 mt-2" disabled={enviando}>
          {enviando && <Spinner animation="border" size="sm" className="me-2" />}
          Criar conta
        </Button>
      </Form>
      <p className="text-center mt-4 mb-0 small text-secondary">
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
    </AuthLayout>
  );
}
