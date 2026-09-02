import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { itemService } from '../../services/item.service';
import { solicitacaoService } from '../../services/solicitacao.service';
import { mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import AvaliacaoModal from '../../components/solicitacoes/AvaliacaoModal';
import { STATUS_SOLICITACAO, STATUS_ITEM } from '../../constants';
import { formatarTempoRelativo } from '../../lib/formatadores';

export default function SolicitacoesRecebidas() {
  const { itemId } = useParams();
  const { mostrar } = useToast();

  const [item, setItem] = useState(null);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [processandoId, setProcessandoId] = useState(null);
  const [confirmandoConclusao, setConfirmandoConclusao] = useState(null);
  const [avaliandoId, setAvaliandoId] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      const [itemData, solicitacoesData] = await Promise.all([
        itemService.buscarPorId(itemId),
        solicitacaoService.listarPorItem(itemId, { tamanho: 50 }),
      ]);
      setItem(itemData);
      setSolicitacoes(solicitacoesData.solicitacoes);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  async function executar(acao, solicitacaoId, mensagemSucesso) {
    setProcessandoId(solicitacaoId);
    try {
      await acao(solicitacaoId);
      mostrar(mensagemSucesso);
      await carregar();
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setProcessandoId(null);
      setConfirmandoConclusao(null);
    }
  }

  if (carregando) return <LoadingSpinner rotulo="Carregando solicitações..." />;
  if (erro) return <Alert variant="danger">{erro}</Alert>;

  return (
    <div className="mc-fade-in">
      <Link to="/painel/meus-itens" className="small d-inline-block mb-2">
        <i className="bi bi-arrow-left me-1" /> Meus itens
      </Link>
      <div className="d-flex align-items-center gap-2 mb-1">
        <h2 className="mb-0">{item?.titulo}</h2>
        <StatusBadge mapa={STATUS_ITEM} valor={item?.status} />
      </div>
      <p className="text-secondary mb-4">Solicitações recebidas para este item.</p>

      {solicitacoes.length === 0 ? (
        <EmptyState icone="bi-inbox" titulo="Nenhuma solicitação ainda" descricao="Quando alguém pedir este item, vai aparecer aqui." />
      ) : (
        <div className="card">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Solicitante</th>
                <th>Status</th>
                <th>Mensagem</th>
                <th>Enviado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {solicitacoes.map((s) => {
                const processando = processandoId === s.id;
                return (
                  <tr key={s.id}>
                    <td>
                      {s.solicitante?.primeiroNome} {s.solicitante?.ultimoNome}
                    </td>
                    <td>
                      <StatusBadge mapa={STATUS_SOLICITACAO} valor={s.status} />
                    </td>
                    <td className="text-secondary small" style={{ maxWidth: 260 }}>
                      {s.mensagem || '—'}
                    </td>
                    <td className="text-secondary small mc-dado">{formatarTempoRelativo(s.criadoEm)}</td>
                    <td className="text-end">
                      <div className="d-flex gap-2 justify-content-end align-items-center">
                        <Button as={Link} to={`/painel/chat/${s.id}`} size="sm" variant="outline-primary">
                          <i className="bi bi-chat-dots me-1" /> Chat
                        </Button>
                        {s.status === 'pendente' && item?.status === 'disponivel' && (
                          <>
                            <Button size="sm" variant="primary" disabled={processando} onClick={() => executar(solicitacaoService.aceitar, s.id, 'Solicitação aceita.')}>
                              {processando ? <Spinner size="sm" animation="border" /> : 'Aceitar'}
                            </Button>
                            <Button size="sm" variant="outline-secondary" disabled={processando} onClick={() => executar(solicitacaoService.recusar, s.id, 'Solicitação recusada.')}>
                              Recusar
                            </Button>
                          </>
                        )}
                        {s.status === 'aceita' && item?.status === 'reservado' && (
                          <Button size="sm" variant="primary" onClick={() => setConfirmandoConclusao(s.id)}>
                            Marcar como concluída
                          </Button>
                        )}
                        {s.status === 'aceita' && item?.status === 'doado' && (
                          <Button size="sm" variant="outline-primary" onClick={() => setAvaliandoId(s.id)}>
                            <i className="bi bi-star me-1" /> Avaliar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      <ConfirmModal
        show={Boolean(confirmandoConclusao)}
        onHide={() => setConfirmandoConclusao(null)}
        onConfirm={() => executar(solicitacaoService.concluir, confirmandoConclusao, 'Doação concluída!')}
        carregando={processandoId === confirmandoConclusao}
        variante="primary"
        titulo="Concluir doação"
        mensagem="Confirme só depois que o item já tiver sido entregue ao solicitante. Essa ação não pode ser desfeita."
        textoConfirmar="Confirmar entrega"
      />

      <AvaliacaoModal show={Boolean(avaliandoId)} onHide={() => setAvaliandoId(null)} solicitacaoId={avaliandoId} />
    </div>
  );
}
