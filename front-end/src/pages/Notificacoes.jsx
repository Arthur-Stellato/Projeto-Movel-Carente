import { useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import { notificacaoService } from '../services/notificacao.service';
import { mensagemDeErro } from '../services/api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import PaginationBar from '../components/common/PaginationBar';
import { TIPOS_NOTIFICACAO_ICONE } from '../constants';
import { formatarTempoRelativo } from '../lib/formatadores';

const TAMANHO_PAGINA = 15;

export default function Notificacoes() {
  const { mostrar } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState({ notificacoes: [], total: 0 });
  const [pagina, setPagina] = useState(1);
  const [apenasNaoLidas, setApenasNaoLidas] = useState(false);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setResultado(await notificacaoService.listar({ apenasNaoLidas: apenasNaoLidas || undefined, pagina, tamanho: TAMANHO_PAGINA }));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, apenasNaoLidas]);

  async function marcarLida(id) {
    try {
      await notificacaoService.marcarComoLida(id);
      setResultado((atual) => ({ ...atual, notificacoes: atual.notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)) }));
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    }
  }

  async function marcarTodasLidas() {
    try {
      await notificacaoService.marcarTodasComoLidas();
      mostrar('Todas as notificações foram marcadas como lidas.');
      carregar();
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    }
  }

  async function remover(id) {
    try {
      await notificacaoService.remover(id);
      setResultado((atual) => ({ ...atual, notificacoes: atual.notificacoes.filter((n) => n.id !== id), total: atual.total - 1 }));
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    }
  }

  return (
    <div className="mc-fade-in">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
        <div>
          <h2 className="mb-1">Notificações</h2>
          <p className="text-secondary mb-0">Fique por dentro do que acontece com seus itens e pedidos.</p>
        </div>
        <div className="d-flex align-items-center gap-3">
          <Form.Check
            type="switch"
            id="apenas-nao-lidas"
            label="Só não lidas"
            checked={apenasNaoLidas}
            onChange={(e) => {
              setApenasNaoLidas(e.target.checked);
              setPagina(1);
            }}
          />
          <Button size="sm" variant="outline-secondary" onClick={marcarTodasLidas}>
            Marcar todas como lidas
          </Button>
        </div>
      </div>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando notificações..." />
      ) : resultado.notificacoes.length === 0 ? (
        <EmptyState icone="bi-bell" titulo="Nenhuma notificação" descricao="Você está em dia." />
      ) : (
        <div className="card">
          <ul className="list-group list-group-flush">
            {resultado.notificacoes.map((n) => (
              <li key={n.id} className={`list-group-item d-flex align-items-start gap-3 py-3 ${!n.lida ? 'bg-light' : ''}`}>
                <i className={`bi ${TIPOS_NOTIFICACAO_ICONE[n.tipo] || 'bi-info-circle'} mt-1`} style={{ color: 'var(--mc-verde-700)' }} />
                <div className="flex-grow-1">
                  <div>{n.mensagem}</div>
                  <div className="small text-secondary">{formatarTempoRelativo(n.criadoEm)}</div>
                </div>
                <div className="d-flex gap-2">
                  {!n.lida && (
                    <Button size="sm" variant="outline-secondary" onClick={() => marcarLida(n.id)}>
                      Marcar lida
                    </Button>
                  )}
                  <Button size="sm" variant="outline-danger" onClick={() => remover(n.id)}>
                    <i className="bi bi-trash" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <PaginationBar pagina={pagina} tamanho={TAMANHO_PAGINA} total={resultado.total} onMudarPagina={setPagina} />
    </div>
  );
}
