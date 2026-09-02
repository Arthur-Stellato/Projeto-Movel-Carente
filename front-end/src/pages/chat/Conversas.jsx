import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Nav from 'react-bootstrap/Nav';
import { solicitacaoService } from '../../services/solicitacao.service';
import { itemService } from '../../services/item.service';
import { resolverUrlImagem, mensagemDeErro } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import { STATUS_SOLICITACAO } from '../../constants';
import { formatarTempoRelativo } from '../../lib/formatadores';

export default function Conversas() {
  const [aba, setAba] = useState('todas'); // 'todas' | 'solicitante' | 'doador'
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [conversasSolicitante, setConversasSolicitante] = useState([]);
  const [conversasDoador, setConversasDoador] = useState([]);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      // 1. Minhas solicitações (como solicitante)
      const resMinhas = await solicitacaoService.minhas({ tamanho: 50 });
      const listaSolicitante = (resMinhas.solicitacoes || []).map((s) => ({
        id: s.id,
        papel: 'solicitante',
        item: s.item,
        outroNome: s.item?.doador?.primeiroNome
          ? `${s.item.doador.primeiroNome} ${s.item.doador.ultimoNome || ''}`
          : 'Doador',
        status: s.status,
        criadoEm: s.criadoEm,
      }));
      setConversasSolicitante(listaSolicitante);

      // 2. Solicitações recebidas nos meus itens (como doador)
      const resItens = await itemService.meus({ tamanho: 50 });
      const meusItens = resItens.itens || [];
      const chamadasSolicitacoes = meusItens.map((item) =>
        solicitacaoService.listarPorItem(item.id, { tamanho: 50 }).catch(() => ({ solicitacoes: [] }))
      );
      const resultadosSolicitacoes = await Promise.all(chamadasSolicitacoes);

      const listaDoador = [];
      resultadosSolicitacoes.forEach((res, index) => {
        const item = meusItens[index];
        (res.solicitacoes || []).forEach((s) => {
          listaDoador.push({
            id: s.id,
            papel: 'doador',
            item,
            outroNome: s.solicitante
              ? `${s.solicitante.primeiroNome} ${s.solicitante.ultimoNome || ''}`
              : 'Solicitante',
            status: s.status,
            criadoEm: s.criadoEm,
          });
        });
      });
      setConversasDoador(listaDoador);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const todas = [...conversasSolicitante, ...conversasDoador].sort(
    (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
  );

  let exibidas = todas;
  if (aba === 'solicitante') exibidas = conversasSolicitante;
  if (aba === 'doador') exibidas = conversasDoador;

  return (
    <div className="mc-fade-in">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-1">Conversas & Chat</h2>
          <p className="text-secondary mb-0">Comunicação direta para combinar entrega e retirada de itens.</p>
        </div>
      </div>

      <Nav variant="pills" activeKey={aba} onSelect={(k) => setAba(k)} className="mb-4 gap-1">
        <Nav.Item>
          <Nav.Link eventKey="todas">
            Todas <span className="badge bg-secondary ms-1">{todas.length}</span>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="solicitante">
            Como solicitante <span className="badge bg-secondary ms-1">{conversasSolicitante.length}</span>
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="doador">
            Como doador <span className="badge bg-secondary ms-1">{conversasDoador.length}</span>
          </Nav.Link>
        </Nav.Item>
      </Nav>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando conversas..." />
      ) : exibidas.length === 0 ? (
        <EmptyState
          icone="bi-chat-dots"
          titulo="Nenhuma conversa encontrada"
          descricao="Ao fazer ou receber uma solicitação de item, você poderá conversar diretamente com a outra pessoa aqui."
          acao={
            <Button as={Link} to="/itens" variant="primary">
              Buscar itens para doar ou receber
            </Button>
          }
        />
      ) : (
        <div className="card shadow-sm border">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th style={{ width: 56 }}></th>
                <th>Item</th>
                <th>Conversando com</th>
                <th>Seu papel</th>
                <th>Status</th>
                <th>Atualizado</th>
                <th className="text-end">Ação</th>
              </tr>
            </thead>
            <tbody>
              {exibidas.map((c) => (
                <tr key={`${c.papel}-${c.id}`}>
                  <td>
                    {c.item?.imagens?.[0] ? (
                      <img
                        src={resolverUrlImagem(c.item.imagens[0].url)}
                        alt=""
                        width={44}
                        height={44}
                        className="rounded"
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="rounded bg-light d-flex align-items-center justify-content-center text-secondary"
                        style={{ width: 44, height: 44 }}
                      >
                        <i className="bi bi-image" />
                      </div>
                    )}
                  </td>
                  <td>
                    <Link to={`/itens/${c.item?.id}`} className="text-decoration-none fw-medium text-dark">
                      {c.item?.titulo}
                    </Link>
                  </td>
                  <td className="fw-medium">{c.outroNome}</td>
                  <td>
                    <span className="badge bg-light text-dark border">
                      {c.papel === 'doador' ? 'Doador do item' : 'Solicitante'}
                    </span>
                  </td>
                  <td>
                    <StatusBadge mapa={STATUS_SOLICITACAO} valor={c.status} />
                  </td>
                  <td className="text-secondary small mc-dado">{formatarTempoRelativo(c.criadoEm)}</td>
                  <td className="text-end">
                    <Button as={Link} to={`/painel/chat/${c.id}`} size="sm" variant="primary">
                      <i className="bi bi-chat-text-fill me-1" /> Abrir chat
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </div>
  );
}

