import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import { solicitacaoService } from '../../services/solicitacao.service';
import { resolverUrlImagem, mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import PaginationBar from '../../components/common/PaginationBar';
import ConfirmModal from '../../components/common/ConfirmModal';
import AvaliacaoModal from '../../components/solicitacoes/AvaliacaoModal';
import { STATUS_SOLICITACAO } from '../../constants';
import { formatarTempoRelativo } from '../../lib/formatadores';

const TAMANHO_PAGINA = 15;

export default function MinhasSolicitacoes() {
  const { mostrar } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState({ solicitacoes: [], total: 0 });
  const [pagina, setPagina] = useState(1);

  const [cancelandoId, setCancelandoId] = useState(null);
  const [confirmando, setConfirmando] = useState(false);
  const [avaliandoId, setAvaliandoId] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setResultado(await solicitacaoService.minhas({ pagina, tamanho: TAMANHO_PAGINA }));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  async function confirmarCancelamento() {
    setConfirmando(true);
    try {
      await solicitacaoService.cancelar(cancelandoId);
      mostrar('Solicitação cancelada.');
      setCancelandoId(null);
      carregar();
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="mc-fade-in">
      <h2 className="mb-1">Minhas solicitações</h2>
      <p className="text-secondary mb-4">Itens que você pediu para receber.</p>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando solicitações..." />
      ) : resultado.solicitacoes.length === 0 ? (
        <EmptyState
          icone="bi-hand-index-thumb"
          titulo="Você ainda não solicitou nenhum item"
          descricao="Explore os itens disponíveis e peça o que precisar."
          acao={
            <Button as={Link} to="/itens" variant="primary">
              Buscar itens
            </Button>
          }
        />
      ) : (
        <div className="card">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th></th>
                <th>Item</th>
                <th>Status</th>
                <th>Mensagem</th>
                <th>Enviado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resultado.solicitacoes.map((s) => (
                <tr key={s.id}>
                  <td style={{ width: 56 }}>
                    {s.item?.imagens?.[0] ? (
                      <img src={resolverUrlImagem(s.item.imagens[0].url)} alt="" width={44} height={44} className="rounded" style={{ objectFit: 'cover' }} />
                    ) : (
                      <div className="rounded bg-light d-flex align-items-center justify-content-center text-secondary" style={{ width: 44, height: 44 }}>
                        <i className="bi bi-image" />
                      </div>
                    )}
                  </td>
                  <td>
                    <Link to={`/itens/${s.item?.id}`} className="text-decoration-none fw-medium">
                      {s.item?.titulo}
                    </Link>
                  </td>
                  <td>
                    <StatusBadge mapa={STATUS_SOLICITACAO} valor={s.status} />
                  </td>
                  <td className="text-secondary small" style={{ maxWidth: 240 }}>
                    {s.mensagem || '—'}
                  </td>
                  <td className="text-secondary small mc-dado">{formatarTempoRelativo(s.criadoEm)}</td>
                  <td className="text-end">
                    <div className="d-flex gap-2 justify-content-end align-items-center">
                      <Button as={Link} to={`/painel/chat/${s.id}`} size="sm" variant="outline-primary">
                        <i className="bi bi-chat-dots me-1" /> Chat
                      </Button>
                      {s.status === 'pendente' && (
                        <Button size="sm" variant="outline-danger" onClick={() => setCancelandoId(s.id)}>
                          Cancelar
                        </Button>
                      )}
                      {s.status === 'aceita' && s.item?.status === 'doado' && (
                        <Button size="sm" variant="outline-primary" onClick={() => setAvaliandoId(s.id)}>
                          <i className="bi bi-star me-1" /> Avaliar
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

      <PaginationBar pagina={pagina} tamanho={TAMANHO_PAGINA} total={resultado.total} onMudarPagina={setPagina} />

      <ConfirmModal
        show={Boolean(cancelandoId)}
        onHide={() => setCancelandoId(null)}
        onConfirm={confirmarCancelamento}
        carregando={confirmando}
        titulo="Cancelar solicitação"
        mensagem="Tem certeza que quer cancelar esta solicitação?"
        textoConfirmar="Cancelar solicitação"
      />

      <AvaliacaoModal show={Boolean(avaliandoId)} onHide={() => setAvaliandoId(null)} solicitacaoId={avaliandoId} />
    </div>
  );
}
