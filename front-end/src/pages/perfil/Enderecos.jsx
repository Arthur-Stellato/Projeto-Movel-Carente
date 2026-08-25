import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Badge from 'react-bootstrap/Badge';
import { usuarioService } from '../../services/usuario.service';
import { mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmModal from '../../components/common/ConfirmModal';
import EnderecoFormModal from '../../components/enderecos/EnderecoFormModal';

export default function Enderecos() {
  const { mostrar } = useToast();
  const [enderecos, setEnderecos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [removendoId, setRemovendoId] = useState(null);
  const [removendo, setRemovendo] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setEnderecos(await usuarioService.listarEnderecos());
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function aoSalvar(salvo) {
    setEnderecos((atual) => {
      const semAntigoPrincipal = salvo.principal ? atual.map((e) => ({ ...e, principal: false })) : atual;
      const existe = semAntigoPrincipal.some((e) => e.id === salvo.id);
      return existe ? semAntigoPrincipal.map((e) => (e.id === salvo.id ? salvo : e)) : [...semAntigoPrincipal, salvo];
    });
    mostrar(editando ? 'Endereço atualizado.' : 'Endereço adicionado.');
  }

  async function confirmarRemocao() {
    setRemovendo(true);
    try {
      await usuarioService.removerEndereco(removendoId);
      setEnderecos((atual) => atual.filter((e) => e.id !== removendoId));
      mostrar('Endereço removido.');
      setRemovendoId(null);
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <div className="mc-fade-in">
      <Link to="/painel/perfil" className="small d-inline-block mb-2">
        <i className="bi bi-arrow-left me-1" /> Meu perfil
      </Link>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">Meus endereços</h2>
        <Button
          variant="primary"
          onClick={() => {
            setEditando(null);
            setModalForm(true);
          }}
        >
          <i className="bi bi-plus-lg me-1" /> Novo endereço
        </Button>
      </div>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando endereços..." />
      ) : enderecos.length === 0 ? (
        <EmptyState icone="bi-geo-alt" titulo="Nenhum endereço cadastrado" descricao="Cadastre um endereço para usar nos seus itens anunciados." />
      ) : (
        <div className="d-flex flex-column gap-2">
          {enderecos.map((e) => (
            <div key={e.id} className="card p-3 d-flex flex-row justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <strong>
                    {e.logradouro}, {e.numero || 's/n'}
                  </strong>
                  {e.principal && <Badge bg="light" text="dark" className="border">Principal</Badge>}
                  {e.tipo && <Badge bg="light" text="dark" className="border">{e.tipo}</Badge>}
                </div>
                <div className="text-secondary small">
                  {e.complemento && `${e.complemento} — `}
                  {e.bairro && `${e.bairro}, `}
                  {e.cidade}/{e.estado} — CEP {e.cep}
                </div>
              </div>
              <div className="d-flex gap-2">
                <Button
                  size="sm"
                  variant="outline-secondary"
                  onClick={() => {
                    setEditando(e);
                    setModalForm(true);
                  }}
                >
                  <i className="bi bi-pencil" />
                </Button>
                <Button size="sm" variant="outline-danger" onClick={() => setRemovendoId(e.id)}>
                  <i className="bi bi-trash" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <EnderecoFormModal show={modalForm} onHide={() => setModalForm(false)} endereco={editando} onSalvo={aoSalvar} />

      <ConfirmModal
        show={Boolean(removendoId)}
        onHide={() => setRemovendoId(null)}
        onConfirm={confirmarRemocao}
        carregando={removendo}
        titulo="Remover endereço"
        mensagem="Tem certeza que quer remover este endereço?"
        textoConfirmar="Remover"
      />
    </div>
  );
}
