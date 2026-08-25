import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import InputGroup from 'react-bootstrap/InputGroup';
import { usuarioService } from '../../services/usuario.service';
import { cepService } from '../../services/cep.service';
import { mensagemDeErro } from '../../services/api';
import { UFS } from '../../constants';

const VAZIO = {
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', tipo: '', principal: false,
};

export default function EnderecoFormModal({ show, onHide, endereco, onSalvo }) {
  const [form, setForm] = useState(VAZIO);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const editando = Boolean(endereco);

  useEffect(() => {
    if (!show) return;
    setErro('');
    setForm(endereco ? { ...VAZIO, ...endereco } : VAZIO);
  }, [show, endereco]);

  function atualizarCampo(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  async function buscarCep() {
    const digitos = form.cep.replace(/\D/g, '');
    if (digitos.length !== 8) {
      setErro('Informe um CEP com 8 dígitos.');
      return;
    }
    setErro('');
    setBuscandoCep(true);
    try {
      const resultado = await cepService.buscar(digitos);
      setForm((atual) => ({
        ...atual,
        cep: digitos,
        logradouro: resultado.logradouro || atual.logradouro,
        bairro: resultado.bairro || atual.bairro,
        cidade: resultado.cidade || atual.cidade,
        estado: resultado.estado || atual.estado,
      }));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setBuscandoCep(false);
    }
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const payload = { ...form, cep: form.cep.replace(/\D/g, '') };
      const salvo = editando
        ? await usuarioService.atualizarEndereco(endereco.id, payload)
        : await usuarioService.criarEndereco(payload);
      onSalvo(salvo);
      onHide();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Form onSubmit={salvar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{editando ? 'Editar endereço' : 'Novo endereço'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <Alert variant="danger">{erro}</Alert>}

          <Row>
            <Col md={5} className="mb-3">
              <Form.Label>CEP</Form.Label>
              <InputGroup>
                <Form.Control
                  value={form.cep}
                  onChange={(e) => atualizarCampo('cep', e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                  required
                />
                <Button variant="outline-secondary" onClick={buscarCep} disabled={buscandoCep}>
                  {buscandoCep ? <Spinner animation="border" size="sm" /> : <i className="bi bi-search" />}
                </Button>
              </InputGroup>
              <Form.Text>Busca automática de logradouro, bairro, cidade e UF.</Form.Text>
            </Col>
            <Col md={7} className="mb-3">
              <Form.Label>Tipo (opcional)</Form.Label>
              <Form.Control
                value={form.tipo || ''}
                maxLength={20}
                onChange={(e) => atualizarCampo('tipo', e.target.value)}
                placeholder="Ex: residencial, comercial"
              />
            </Col>
          </Row>

          <Form.Group className="mb-3">
            <Form.Label>Logradouro</Form.Label>
            <Form.Control value={form.logradouro} maxLength={255} onChange={(e) => atualizarCampo('logradouro', e.target.value)} required />
          </Form.Group>

          <Row>
            <Col md={4} className="mb-3">
              <Form.Label>Número</Form.Label>
              <Form.Control value={form.numero || ''} maxLength={20} onChange={(e) => atualizarCampo('numero', e.target.value)} />
            </Col>
            <Col md={8} className="mb-3">
              <Form.Label>Complemento</Form.Label>
              <Form.Control value={form.complemento || ''} maxLength={100} onChange={(e) => atualizarCampo('complemento', e.target.value)} />
            </Col>
          </Row>

          <Row>
            <Col md={4} className="mb-3">
              <Form.Label>Bairro</Form.Label>
              <Form.Control value={form.bairro || ''} maxLength={100} onChange={(e) => atualizarCampo('bairro', e.target.value)} />
            </Col>
            <Col md={5} className="mb-3">
              <Form.Label>Cidade</Form.Label>
              <Form.Control value={form.cidade} maxLength={100} onChange={(e) => atualizarCampo('cidade', e.target.value)} required />
            </Col>
            <Col md={3} className="mb-3">
              <Form.Label>Estado</Form.Label>
              <Form.Select value={form.estado} onChange={(e) => atualizarCampo('estado', e.target.value)} required>
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </Form.Select>
            </Col>
          </Row>

          <Form.Check
            type="checkbox"
            id="endereco-principal"
            label="Definir como endereço principal"
            checked={form.principal}
            onChange={(e) => atualizarCampo('principal', e.target.checked)}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={salvando}>
            {salvando && <Spinner animation="border" size="sm" className="me-2" />}
            Salvar endereço
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
