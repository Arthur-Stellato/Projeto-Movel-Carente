import { useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import Form from 'react-bootstrap/Form';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { usuarioService } from '../../services/usuario.service';
import { mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import PaginationBar from '../../components/common/PaginationBar';
import ConfirmModal from '../../components/common/ConfirmModal';
import { formatarData } from '../../lib/formatadores';

const TAMANHO_PAGINA = 15;

export default function AdminUsuarios() {
  const { mostrar } = useToast();
  const { usuario: euMesmo } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState({ usuarios: [], total: 0 });
  const [pagina, setPagina] = useState(1);
  const [filtroAtivo, setFiltroAtivo] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [desativando, setDesativando] = useState(null);
  const [processando, setProcessando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setResultado(
        await usuarioService.listarTodos({
          ativo: filtroAtivo === '' ? undefined : filtroAtivo === 'true',
          tipo: filtroTipo || undefined,
          pagina,
          tamanho: TAMANHO_PAGINA,
        })
      );
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroAtivo, filtroTipo]);

  async function confirmarDesativacao() {
    setProcessando(true);
    try {
      await usuarioService.desativarConta(desativando.id);
      setResultado((atual) => ({ ...atual, usuarios: atual.usuarios.map((u) => (u.id === desativando.id ? { ...u, ativo: false } : u)) }));
      mostrar('Usuário desativado.');
      setDesativando(null);
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setProcessando(false);
    }
  }

  async function reativar(u) {
    try {
      await usuarioService.reativarConta(u.id);
      setResultado((atual) => ({ ...atual, usuarios: atual.usuarios.map((item) => (item.id === u.id ? { ...item, ativo: true } : item)) }));
      mostrar('Usuário reativado.');
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="mc-fade-in">
      <h2 className="mb-1">Usuários</h2>
      <p className="text-secondary mb-4">Gerencie as contas cadastradas na plataforma.</p>

      <Row className="g-2 mb-3">
        <Col md={3}>
          <Form.Select
            value={filtroAtivo}
            onChange={(e) => {
              setFiltroAtivo(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Ativos e inativos</option>
            <option value="true">Somente ativos</option>
            <option value="false">Somente inativos</option>
          </Form.Select>
        </Col>
        <Col md={3}>
          <Form.Select
            value={filtroTipo}
            onChange={(e) => {
              setFiltroTipo(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos os tipos</option>
            <option value="usuario">Usuário</option>
            <option value="admin">Admin</option>
          </Form.Select>
        </Col>
      </Row>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando usuários..." />
      ) : resultado.usuarios.length === 0 ? (
        <EmptyState icone="bi-people" titulo="Nenhum usuário encontrado" />
      ) : (
        <div className="card">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Tipo</th>
                <th>Status</th>
                <th>Desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resultado.usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.primeiroNome} {u.ultimoNome}
                  </td>
                  <td className="small text-secondary">{u.email}</td>
                  <td>
                    <Badge bg="light" text="dark" className="border text-capitalize">
                      {u.tipo}
                    </Badge>
                  </td>
                  <td>
                    <Badge bg="light" text="dark" className="border">
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="text-secondary small mc-dado">{formatarData(u.criadoEm)}</td>
                  <td className="text-end">
                    {u.id !== euMesmo.id &&
                      (u.ativo ? (
                        <Button size="sm" variant="outline-danger" onClick={() => setDesativando(u)}>
                          Desativar
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline-primary" onClick={() => reativar(u)}>
                          Reativar
                        </Button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <PaginationBar pagina={pagina} tamanho={TAMANHO_PAGINA} total={resultado.total} onMudarPagina={setPagina} />

      <ConfirmModal
        show={Boolean(desativando)}
        onHide={() => setDesativando(null)}
        onConfirm={confirmarDesativacao}
        carregando={processando}
        titulo="Desativar usuário"
        mensagem={`Tem certeza que quer desativar a conta de "${desativando?.primeiroNome} ${desativando?.ultimoNome}"?`}
        textoConfirmar="Desativar"
      />
    </div>
  );
}
