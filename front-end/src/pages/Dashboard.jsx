import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Card from 'react-bootstrap/Card';
import { itemService } from '../services/item.service';
import { solicitacaoService } from '../services/solicitacao.service';
import { favoritoService } from '../services/favorito.service';
import { notificacaoService } from '../services/notificacao.service';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import { formatarTempoRelativo } from '../lib/formatadores';
import { TIPOS_NOTIFICACAO_ICONE } from '../constants';

function CartaoMetrica({ icone, rotulo, valor, cor, to }) {
  const conteudo = (
    <Card className="h-100 mc-fade-in">
      <Card.Body className="d-flex align-items-center gap-3">
        <div
          className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
          style={{ width: 48, height: 48, background: `var(--mc-${cor}-100)`, color: `var(--mc-${cor}-700)`, fontSize: '1.3rem' }}
        >
          <i className={`bi ${icone}`} />
        </div>
        <div>
          <div className="mc-dado fs-3 lh-1" style={{ color: 'var(--mc-verde-900)' }}>
            {valor}
          </div>
          <div className="text-secondary small">{rotulo}</div>
        </div>
      </Card.Body>
    </Card>
  );
  return to ? (
    <Link to={to} className="text-decoration-none">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [carregando, setCarregando] = useState(true);
  const [metricas, setMetricas] = useState({ itensAtivos: 0, solicitacoesPendentes: 0, favoritos: 0, naoLidas: 0 });
  const [recentes, setRecentes] = useState([]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const [itens, solicitacoes, favoritos, notificacoes] = await Promise.all([
          itemService.meusItens(),
          solicitacaoService.minhas({ tamanho: 50 }),
          favoritoService.listar({ tamanho: 1 }),
          notificacaoService.listar({ tamanho: 6 }),
        ]);
        if (cancelado) return;
        setMetricas({
          itensAtivos: itens.filter((i) => i.status === 'disponivel' || i.status === 'reservado').length,
          solicitacoesPendentes: solicitacoes.solicitacoes.filter((s) => s.status === 'pendente').length,
          favoritos: favoritos.total,
          naoLidas: notificacoes.notificacoes.filter((n) => !n.lida).length,
        });
        setRecentes(notificacoes.notificacoes);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  if (carregando) return <LoadingSpinner rotulo="Carregando seu painel..." />;

  return (
    <div className="mc-fade-in">
      <h2 className="mb-1">Olá, {usuario.primeiroNome}</h2>
      <p className="text-secondary mb-4">Aqui está um resumo da sua atividade na MóvelCarente.</p>

      <Row className="g-3 mb-4">
        <Col sm={6} lg={3}>
          <CartaoMetrica icone="bi-box-seam" rotulo="Itens ativos" valor={metricas.itensAtivos} cor="verde" to="/painel/meus-itens" />
        </Col>
        <Col sm={6} lg={3}>
          <CartaoMetrica icone="bi-hand-index-thumb" rotulo="Solicitações pendentes" valor={metricas.solicitacoesPendentes} cor="ocre" to="/painel/solicitacoes" />
        </Col>
        <Col sm={6} lg={3}>
          <CartaoMetrica icone="bi-heart" rotulo="Favoritos" valor={metricas.favoritos} cor="verde" to="/painel/favoritos" />
        </Col>
        <Col sm={6} lg={3}>
          <CartaoMetrica icone="bi-bell" rotulo="Notificações não lidas" valor={metricas.naoLidas} cor="tijolo" to="/painel/notificacoes" />
        </Col>
      </Row>

      <Card>
        <Card.Header className="bg-transparent border-bottom d-flex justify-content-between align-items-center">
          <strong>Atividade recente</strong>
          <Link to="/painel/notificacoes" className="small">
            Ver todas
          </Link>
        </Card.Header>
        <Card.Body className="p-0">
          {recentes.length === 0 ? (
            <EmptyState icone="bi-bell" titulo="Nenhuma notificação ainda" descricao="Quando algo acontecer com seus itens ou pedidos, você verá aqui." />
          ) : (
            <ul className="list-group list-group-flush">
              {recentes.map((n) => (
                <li key={n.id} className="list-group-item d-flex align-items-start gap-3 py-3">
                  <i className={`bi ${TIPOS_NOTIFICACAO_ICONE[n.tipo] || 'bi-info-circle'} mt-1`} style={{ color: 'var(--mc-verde-700)' }} />
                  <div className="flex-grow-1">
                    <div>{n.mensagem}</div>
                    <div className="small text-secondary">{formatarTempoRelativo(n.criadoEm)}</div>
                  </div>
                  {!n.lida && <span className="badge rounded-pill" style={{ background: 'var(--mc-ocre-600)', height: 8, width: 8, padding: 0, marginTop: 6 }} />}
                </li>
              ))}
            </ul>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
