import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import { itemService } from '../../services/item.service';
import { resolverUrlImagem, mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import ItemFormModal from '../../components/itens/ItemFormModal';
import { STATUS_ITEM } from '../../constants';

export default function MeusItens() {
  const { mostrar } = useToast();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [modalForm, setModalForm] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [itemCancelando, setItemCancelando] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setItens(await itemService.meusItens());
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirCriacao() {
    setItemEditando(null);
    setModalForm(true);
  }

  function abrirEdicao(item) {
    setItemEditando(item);
    setModalForm(true);
  }

  function aoSalvar(itemSalvo) {
    setItens((atual) => {
      const existe = atual.some((i) => i.id === itemSalvo.id);
      return existe ? atual.map((i) => (i.id === itemSalvo.id ? { ...i, ...itemSalvo } : i)) : [itemSalvo, ...atual];
    });
    mostrar(itemEditando ? 'Item atualizado.' : 'Item anunciado com sucesso.');
  }

  async function confirmarCancelamento() {
    setCancelando(true);
    try {
      await itemService.cancelar(itemCancelando.id);
      setItens((atual) => atual.map((i) => (i.id === itemCancelando.id ? { ...i, status: 'cancelado' } : i)));
      mostrar('Item cancelado.');
      setItemCancelando(null);
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="mc-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-1">Meus itens</h2>
          <p className="text-secondary mb-0">Gerencie os itens que você anunciou para doação.</p>
        </div>
        <Button variant="primary" onClick={abrirCriacao}>
          <i className="bi bi-plus-lg me-1" /> Anunciar item
        </Button>
      </div>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando seus itens..." />
      ) : itens.length === 0 ? (
        <EmptyState
          icone="bi-box-seam"
          titulo="Você ainda não anunciou nenhum item"
          descricao="Que tal doar algo que não usa mais?"
          acao={
            <Button variant="primary" onClick={abrirCriacao}>
              Anunciar meu primeiro item
            </Button>
          }
        />
      ) : (
        <div className="card">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th></th>
                <th>Título</th>
                <th>Categoria</th>
                <th>Status</th>
                <th>Local</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.id}>
                  <td style={{ width: 64 }}>
                    {item.imagens?.[0] ? (
                      <img src={resolverUrlImagem(item.imagens[0].url)} alt="" width={48} height={48} className="rounded" style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className="rounded bg-light d-flex align-items-center justify-content-center text-secondary" style={{ width: 48, height: 48 }}>
                        <i className="bi bi-image" />
                      </div>
                    )}
                  </td>
                  <td>
                    <Link to={`/itens/${item.id}`} className="fw-medium text-decoration-none">
                      {item.titulo}
                    </Link>
                  </td>
                  <td>{item.categoria?.nome}</td>
                  <td>
                    <StatusBadge mapa={STATUS_ITEM} valor={item.status} />
                  </td>
                  <td className="text-secondary small">
                    {item.cidade}/{item.estado}
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end">
                      <Button as={Link} to={`/painel/itens/${item.id}/solicitacoes`} size="sm" variant="outline-primary">
                        Solicitações
                      </Button>
                      {(item.status === 'disponivel' || item.status === 'reservado') && (
                        <>
                          <Button size="sm" variant="outline-secondary" onClick={() => abrirEdicao(item)}>
                            <i className="bi bi-pencil" />
                          </Button>
                          <Button size="sm" variant="outline-danger" onClick={() => setItemCancelando(item)}>
                            <i className="bi bi-x-lg" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <ItemFormModal show={modalForm} onHide={() => setModalForm(false)} item={itemEditando} onSalvo={aoSalvar} />

      <ConfirmModal
        show={Boolean(itemCancelando)}
        onHide={() => setItemCancelando(null)}
        onConfirm={confirmarCancelamento}
        carregando={cancelando}
        titulo="Cancelar item"
        mensagem={`Isso cancela "${itemCancelando?.titulo}" e todas as solicitações pendentes dele.`}
        textoConfirmar="Cancelar item"
      />
    </div>
  );
}
