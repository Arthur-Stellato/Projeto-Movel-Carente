import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { chatService } from '../../services/chat.service';
import { resolverUrlImagem, mensagemDeErro } from '../../services/api';
import { STATUS_SOLICITACAO, STATUS_ITEM } from '../../constants';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatarTempoRelativo } from '../../lib/formatadores';

export default function Chat() {
  const { solicitacaoId } = useParams();
  const { usuario } = useAuth();
  const { mostrar } = useToast();

  const [solicitacao, setSolicitacao] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [socketConectado, setSocketConectado] = useState(false);

  const mensagensFimRef = useRef(null);
  const socketRef = useRef(null);

  const rolarParaFim = useCallback((suave = true) => {
    mensagensFimRef.current?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto' });
  }, []);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await chatService.buscarMensagens(solicitacaoId);
      setSolicitacao(dados.solicitacao);
      setMensagens(dados.mensagens || []);
      setTimeout(() => rolarParaFim(false), 100);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }, [solicitacaoId, rolarParaFim]);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    const socket = chatService.conectarSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketConectado(true);
      socket.emit('solicitacao:entrar', { solicitacaoId });
    });

    socket.on('disconnect', () => {
      setSocketConectado(false);
    });

    socket.on('mensagem:nova', ({ mensagem }) => {
      if (mensagem && mensagem.solicitacaoId === solicitacaoId) {
        setMensagens((atuais) => {
          if (atuais.some((m) => m.id === mensagem.id)) return atuais;
          return [...atuais, mensagem];
        });
        setTimeout(() => rolarParaFim(true), 50);
      }
    });

    socket.on('erro', (errPayload) => {
      if (errPayload?.mensagem) {
        mostrar(errPayload.mensagem, 'erro');
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [solicitacaoId, mostrar, rolarParaFim]);

  async function enviar(evento) {
    if (evento) evento.preventDefault();
    const conteudo = texto.trim();
    if (!conteudo || enviando) return;

    setEnviando(true);
    setTexto('');

    try {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('mensagem:enviar', { solicitacaoId, conteudo });
      } else {
        const msgEnviada = await chatService.enviarMensagem(solicitacaoId, conteudo);
        setMensagens((atuais) => {
          if (atuais.some((m) => m.id === msgEnviada.id)) return atuais;
          return [...atuais, msgEnviada];
        });
        setTimeout(() => rolarParaFim(true), 50);
      }
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
      setTexto(conteudo);
    } finally {
      setEnviando(false);
    }
  }

  function tratarKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  }

  if (carregando) return <LoadingSpinner rotulo="Carregando conversa..." />;
  if (erro) return <Alert variant="danger">{erro}</Alert>;
  if (!solicitacao) return <Alert variant="warning">Solicitação não encontrada.</Alert>;

  const ehDoador = usuario.id === solicitacao.item?.doadorId;
  const outroParticipante = ehDoador ? solicitacao.solicitante : solicitacao.item?.doador;
  const papelOutro = ehDoador ? 'Solicitante' : 'Doador';
  const chatBloqueado = solicitacao.status === 'recusada' || solicitacao.status === 'cancelada';

  return (
    <div className="mc-fade-in" style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Navegação de volta */}
      <div className="mb-3 d-flex justify-content-between align-items-center">
        <Link to="/painel/conversas" className="text-decoration-none small text-secondary">
          <i className="bi bi-arrow-left me-1" /> Voltar para Conversas
        </Link>
        {socketConectado ? (
          <span className="small text-success d-flex align-items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#2a6350', display: 'inline-block' }} />
            Tempo real ativo
          </span>
        ) : (
          <span className="small text-muted d-flex align-items-center gap-1">
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#8a988e', display: 'inline-block' }} />
            Conectando...
          </span>
        )}
      </div>

      {/* Card principal do Chat */}
      <Card className="shadow-sm border">
        {/* Cabeçalho com detalhes do item e participante */}
        <Card.Header className="bg-white py-3 border-bottom">
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div className="d-flex align-items-center gap-3">
              {solicitacao.item?.imagens?.[0] ? (
                <img
                  src={resolverUrlImagem(solicitacao.item.imagens[0].url)}
                  alt=""
                  width={52}
                  height={52}
                  className="rounded"
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div
                  className="rounded bg-light d-flex align-items-center justify-content-center text-secondary"
                  style={{ width: 52, height: 52 }}
                >
                  <i className="bi bi-image fs-4" />
                </div>
              )}
              <div>
                <div className="d-flex align-items-center gap-2">
                  <Link to={`/itens/${solicitacao.item?.id}`} className="fw-semibold text-dark text-decoration-none h6 mb-0">
                    {solicitacao.item?.titulo}
                  </Link>
                  <StatusBadge mapa={STATUS_ITEM} valor={solicitacao.item?.status} />
                </div>
                <div className="text-secondary small mt-1">
                  Conversando com <strong>{outroParticipante?.primeiroNome} {outroParticipante?.ultimoNome}</strong> ({papelOutro})
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <span className="small text-secondary">Solicitação:</span>
              <StatusBadge mapa={STATUS_SOLICITACAO} valor={solicitacao.status} />
            </div>
          </div>
        </Card.Header>

        {/* Alerta caso a conversa esteja fechada */}
        {chatBloqueado && (
          <Alert variant="secondary" className="m-3 mb-0 py-2 small d-flex align-items-center gap-2">
            <i className="bi bi-info-circle-fill text-secondary fs-5" />
            <span>
              Esta solicitação está com status <strong>{solicitacao.status}</strong>. O chat foi encerrado e não aceita novas mensagens.
            </span>
          </Alert>
        )}

        {/* Área de mensagens */}
        <Card.Body
          className="p-3 d-flex flex-column gap-3"
          style={{
            minHeight: 380,
            maxHeight: 520,
            overflowY: 'auto',
            backgroundColor: 'var(--mc-papel-alto)',
          }}
        >
          {mensagens.length === 0 ? (
            <div className="text-center py-5 my-auto text-secondary">
              <i className="bi bi-chat-dots fs-1 d-block mb-2 text-muted" />
              <p className="fw-medium mb-1">Nenhuma mensagem ainda</p>
              <p className="small mb-0">Envie uma mensagem para combinar os detalhes da doação ou retirada.</p>
            </div>
          ) : (
            mensagens.map((msg) => {
              const ehMeu = msg.remetenteId === usuario.id;
              return (
                <div
                  key={msg.id}
                  className={`d-flex flex-column ${ehMeu ? 'align-items-end' : 'align-items-start'}`}
                >
                  <div className="small text-secondary mb-1 px-1">
                    {ehMeu ? 'Você' : `${msg.remetente?.primeiroNome || 'Participante'}`}
                  </div>
                  <div
                    className="p-3 rounded-3 shadow-sm"
                    style={{
                      maxWidth: '75%',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      backgroundColor: ehMeu ? 'var(--mc-verde-800)' : '#ffffff',
                      color: ehMeu ? '#ffffff' : 'var(--mc-tinta)',
                      border: ehMeu ? 'none' : '1px solid var(--mc-borda)',
                      borderBottomRightRadius: ehMeu ? '4px' : undefined,
                      borderBottomLeftRadius: !ehMeu ? '4px' : undefined,
                    }}
                  >
                    {msg.conteudo}
                  </div>
                  <div className="small text-muted mt-1 px-1 mc-dado" style={{ fontSize: '0.75rem' }}>
                    {formatarTempoRelativo(msg.criadoEm)}
                  </div>
                </div>
              );
            })
          )}
          <div ref={mensagensFimRef} />
        </Card.Body>

        {/* Formulário de envio */}
        <Card.Footer className="bg-white p-3 border-top">
          <Form onSubmit={enviar}>
            <div className="d-flex gap-2">
              <Form.Control
                as="textarea"
                rows={2}
                placeholder={chatBloqueado ? 'Conversa finalizada' : 'Digite sua mensagem... (Enter para enviar)'}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={tratarKeyDown}
                disabled={chatBloqueado || enviando}
                style={{ resize: 'none' }}
              />
              <Button
                type="submit"
                variant="primary"
                className="d-flex align-items-center justify-content-center px-4"
                disabled={chatBloqueado || enviando || !texto.trim()}
              >
                {enviando ? (
                  <Spinner size="sm" animation="border" />
                ) : (
                  <>
                    <i className="bi bi-send-fill me-1" /> Enviar
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card.Footer>
      </Card>
    </div>
  );
}
