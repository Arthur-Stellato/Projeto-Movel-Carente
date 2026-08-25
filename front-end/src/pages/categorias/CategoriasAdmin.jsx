import { useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import Badge from 'react-bootstrap/Badge';
import { categoriaService } from '../../services/categoria.service';
import { mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ConfirmModal from '../../components/common/ConfirmModal';

function CategoriaFormModal({ show, onHide, categoria, onSalvo }) {
  const [form, setForm] = useState({ nome: '', icone: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const editando = Boolean(categoria);

  useEffect(() => {
    if (show) {
      setForm(categoria ? { nome: categoria.nome, icone: categoria.icone || '' } : { nome: '', icone: '' });
      setErro('');
    }
  }, [show, categoria]);

  async function salvar(evento) {
    evento.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      const salvo = editando ? await categoriaService.atualizar(categoria.id, form) : await categoriaService.criar(form);
      onSalvo(salvo);
      onHide();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Form onSubmit={salvar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">{editando ? 'Editar categoria' : 'Nova categoria'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <Alert variant="danger">{erro}</Alert>}
          <Form.Group className="mb-3">
            <Form.Label>Nome</Form.Label>
            <Form.Control value={form.nome} maxLength={100} onChange={(e) => setForm((a) => ({ ...a, nome: e.target.value }))} required />
          </Form.Group>
          <Form.Group>
            <Form.Label>Ícone (classe do Bootstrap Icons, opcional)</Form.Label>
            <Form.Control value={form.icone} maxLength={100} onChange={(e) => setForm((a) => ({ ...a, icone: e.target.value }))} placeholder="Ex: bi-house-door" />
            {form.icone && (
              <div className="mt-2">
                <i className={`bi ${form.icone}`} /> pré-visualização
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={salvando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={salvando}>
            {salvando && <Spinner animation="border" size="sm" className="me-2" />}
            Salvar
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function CategoriasAdmin() {
  const { mostrar } = useToast();
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [desativando, setDesativando] = useState(null);
  const [processando, setProcessando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setCategorias(await categoriaService.listar(true));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function aoSalvar(salva) {
    setCategorias((atual) => {
      const existe = atual.some((c) => c.id === salva.id);
      return existe ? atual.map((c) => (c.id === salva.id ? salva : c)) : [...atual, salva];
    });
    mostrar(editando ? 'Categoria atualizada.' : 'Categoria criada.');
  }

  async function confirmarDesativacao() {
    setProcessando(true);
    try {
      await categoriaService.desativar(desativando.id);
      setCategorias((atual) => atual.map((c) => (c.id === desativando.id ? { ...c, ativo: false } : c)));
      mostrar('Categoria desativada.');
      setDesativando(null);
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setProcessando(false);
    }
  }

  async function reativar(categoria) {
    try {
      const atualizada = await categoriaService.atualizar(categoria.id, { ativo: true });
      setCategorias((atual) => atual.map((c) => (c.id === categoria.id ? atualizada : c)));
      mostrar('Categoria reativada.');
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="mc-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Categorias</h2>
          <p className="text-secondary mb-0">Categorias usadas para classificar os itens anunciados.</p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditando(null);
            setModalForm(true);
          }}
        >
          <i className="bi bi-plus-lg me-1" /> Nova categoria
        </Button>
      </div>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando categorias..." />
      ) : (
        <div className="card">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th></th>
                <th>Nome</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {categorias.map((c) => (
                <tr key={c.id}>
                  <td style={{ width: 40 }}>{c.icone && <i className={`bi ${c.icone}`} />}</td>
                  <td>{c.nome}</td>
                  <td>
                    <Badge bg="light" text="dark" className="border">
                      {c.ativo === false ? 'Inativa' : 'Ativa'}
                    </Badge>
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => {
                          setEditando(c);
                          setModalForm(true);
                        }}
                      >
                        <i className="bi bi-pencil" />
                      </Button>
                      {c.ativo === false ? (
                        <Button size="sm" variant="outline-primary" onClick={() => reativar(c)}>
                          Reativar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline-danger" onClick={() => setDesativando(c)}>
                          Desativar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <CategoriaFormModal show={modalForm} onHide={() => setModalForm(false)} categoria={editando} onSalvo={aoSalvar} />

      <ConfirmModal
        show={Boolean(desativando)}
        onHide={() => setDesativando(null)}
        onConfirm={confirmarDesativacao}
        carregando={processando}
        titulo="Desativar categoria"
        mensagem={`Tem certeza que quer desativar "${desativando?.nome}"? Ela deixa de aparecer para novos itens.`}
        textoConfirmar="Desativar"
      />
    </div>
  );
}
