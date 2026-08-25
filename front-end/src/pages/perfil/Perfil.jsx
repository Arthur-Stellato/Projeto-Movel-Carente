import { useState } from 'react';
import { Link } from 'react-router-dom';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { useAuth } from '../../context/AuthContext';
import { usuarioService } from '../../services/usuario.service';
import { mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';

export default function Perfil() {
  const { usuario, atualizarUsuario } = useAuth();
  const { mostrar } = useToast();

  const [dados, setDados] = useState({ primeiroNome: usuario.primeiroNome, ultimoNome: usuario.ultimoNome, telefone: usuario.telefone || '' });
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [erroDados, setErroDados] = useState('');

  const [senha, setSenha] = useState({ senhaAtual: '', novaSenha: '' });
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [erroSenha, setErroSenha] = useState('');

  async function salvarDados(evento) {
    evento.preventDefault();
    setErroDados('');
    setSalvandoDados(true);
    try {
      const atualizado = await usuarioService.atualizarPerfil({ ...dados, telefone: dados.telefone || undefined });
      atualizarUsuario(atualizado);
      mostrar('Perfil atualizado.');
    } catch (err) {
      setErroDados(mensagemDeErro(err));
    } finally {
      setSalvandoDados(false);
    }
  }

  async function salvarSenha(evento) {
    evento.preventDefault();
    setErroSenha('');
    setSalvandoSenha(true);
    try {
      await usuarioService.alterarSenha(senha.senhaAtual, senha.novaSenha);
      setSenha({ senhaAtual: '', novaSenha: '' });
      mostrar('Senha alterada com sucesso.');
    } catch (err) {
      setErroSenha(mensagemDeErro(err));
    } finally {
      setSalvandoSenha(false);
    }
  }

  return (
    <div className="mc-fade-in" style={{ maxWidth: 640 }}>
      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h2 className="mb-1">Meu perfil</h2>
          <p className="text-secondary mb-0">Seus dados pessoais e de acesso.</p>
        </div>
        <Button as={Link} to="/painel/perfil/enderecos" variant="outline-primary">
          <i className="bi bi-geo-alt me-1" /> Meus endereços
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Body>
          <Card.Title as="h5">Dados pessoais</Card.Title>
          {erroDados && <Alert variant="danger">{erroDados}</Alert>}
          <Form onSubmit={salvarDados}>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Primeiro nome</Form.Label>
                <Form.Control value={dados.primeiroNome} onChange={(e) => setDados((a) => ({ ...a, primeiroNome: e.target.value }))} required />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>Último nome</Form.Label>
                <Form.Control value={dados.ultimoNome} onChange={(e) => setDados((a) => ({ ...a, ultimoNome: e.target.value }))} required />
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Telefone</Form.Label>
              <Form.Control value={dados.telefone} onChange={(e) => setDados((a) => ({ ...a, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
            </Form.Group>
            <Row>
              <Col md={6} className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control value={usuario.email} disabled />
              </Col>
              <Col md={6} className="mb-3">
                <Form.Label>CPF</Form.Label>
                <Form.Control value={usuario.cpf} disabled />
              </Col>
            </Row>
            <Button type="submit" variant="primary" disabled={salvandoDados}>
              {salvandoDados && <Spinner animation="border" size="sm" className="me-2" />}
              Salvar
            </Button>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title as="h5">Alterar senha</Card.Title>
          {erroSenha && <Alert variant="danger">{erroSenha}</Alert>}
          <Form onSubmit={salvarSenha}>
            <Form.Group className="mb-3">
              <Form.Label>Senha atual</Form.Label>
              <Form.Control type="password" value={senha.senhaAtual} onChange={(e) => setSenha((a) => ({ ...a, senhaAtual: e.target.value }))} required />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Nova senha</Form.Label>
              <Form.Control type="password" value={senha.novaSenha} onChange={(e) => setSenha((a) => ({ ...a, novaSenha: e.target.value }))} required />
              <Form.Text>Mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.</Form.Text>
            </Form.Group>
            <Button type="submit" variant="primary" disabled={salvandoSenha}>
              {salvandoSenha && <Spinner animation="border" size="sm" className="me-2" />}
              Alterar senha
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
