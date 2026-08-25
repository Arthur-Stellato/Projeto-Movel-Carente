import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Carousel from 'react-bootstrap/Carousel';
import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import { itemService } from '../../services/item.service';
import { solicitacaoService } from '../../services/solicitacao.service';
import { favoritoService } from '../../services/favorito.service';
import { resolverUrlImagem, mensagemDeErro } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import StatusBadge from '../../components/common/StatusBadge';
import FavoritoButton from '../../components/itens/FavoritoButton';
import DenunciarModal from '../../components/itens/DenunciarModal';
import ImagemUploader from '../../components/itens/ImagemUploader';
import ConfirmModal from '../../components/common/ConfirmModal';
import { CONDICOES_ITEM, STATUS_ITEM } from '../../constants';

export default function ItemDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario, logado } = useAuth();
  const { mostrar } = useToast();

  const [item, setItem] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [favoritado, setFavoritado] = useState(false);

  const [modalSolicitar, setModalSolicitar] = useState(false);
  const [mensagemSolicitacao, setMensagemSolicitacao] = useState('');
  const [enviandoSolicitacao, setEnviandoSolicitacao] = useState(false);

  const [modalDenuncia, setModalDenuncia] = useState(null);
  const [modalCancelar, setModalCancelar] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await itemService.buscarPorId(id);
      setItem(dados);
      if (logado) {
        try {
          setFavoritado(await favoritoService.verificar(id));
        } catch {
          // se falhar, mantém como não-favoritado — não é crítico pra exibição
        }
      }
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }, [id, logado]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) return <LoadingSpinner rotulo="Carregando item..." />;
  if (erro || !item) {
    return (
      <Container className="py-5 text-center">
        <Alert variant="danger">{erro || 'Item não encontrado.'}</Alert>
        <Link to="/itens">Voltar para a busca</Link>
      </Container>
    );
  }

  const souDono = usuario?.id === item.doador?.id;
  const condicao = CONDICOES_ITEM.find((c) => c.valor === item.condicao)?.rotulo || item.condicao;

  async function solicitar(evento) {
    evento.preventDefault();
    setEnviandoSolicitacao(true);
    try {
      await solicitacaoService.criar(item.id, mensagemSolicitacao);
      mostrar('Solicitação enviada ao doador!');
      setModalSolicitar(false);
      setMensagemSolicitacao('');
      carregar();
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
    } finally {
      setEnviandoSolicitacao(false);
    }
  }

  async function cancelarItem() {
    setCancelando(true);
    try {
      await itemService.cancelar(item.id);
      mostrar('Item cancelado.');
      navigate('/painel/meus-itens');
    } catch (err) {
      mostrar(mensagemDeErro(err), 'erro');
      setCancelando(false);
    }
  }

  return (
    <Container className="py-4 mc-fade-in">
      <Row className="g-4">
        <Col lg={7}>
          {item.imagens?.length > 0 ? (
            <Carousel indicators={item.imagens.length > 1} controls={item.imagens.length > 1} className="rounded overflow-hidden border">
              {item.imagens.map((img) => (
                <Carousel.Item key={img.id}>
                  <img src={resolverUrlImagem(img.url)} alt={item.titulo} style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }} />
                </Carousel.Item>
              ))}
            </Carousel>
          ) : (
            <div className="mc-item-card__placeholder rounded border" style={{ aspectRatio: '4/3' }}>
              <i className="bi bi-image" style={{ fontSize: '3rem' }} />
            </div>
          )}

          {souDono && (
            <div className="mt-3 p-3 border rounded">
              <strong className="d-block mb-2">Gerenciar fotos</strong>
              <ImagemUploader item={item} onAtualizado={(imagens) => setItem((atual) => ({ ...atual, imagens }))} />
            </div>
          )}
        </Col>

        <Col lg={5}>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <h2 className="mb-2">{item.titulo}</h2>
            {logado && !souDono && (
              <FavoritoButton itemId={item.id} favoritado={favoritado} onMudar={(_, v) => setFavoritado(v)} tamanho="1.3rem" />
            )}
          </div>

          <div className="d-flex flex-wrap gap-2 mb-3">
            <StatusBadge mapa={STATUS_ITEM} valor={item.status} />
            {item.categoria && (
              <Badge bg="light" text="dark" className="border">
                {item.categoria.icone && <i className={`bi ${item.categoria.icone} me-1`} />}
                {item.categoria.nome}
              </Badge>
            )}
            <Badge bg="light" text="dark" className="border">
              {condicao}
            </Badge>
          </div>

          <p style={{ whiteSpace: 'pre-line' }}>{item.descricao}</p>

          <div className="text-secondary mb-3">
            <i className="bi bi-geo-alt me-1" /> {item.cidade}/{item.estado}
          </div>

          <div className="card p-3 mb-3">
            <strong className="mb-2 d-block">Doador</strong>
            <div>{item.doador?.primeiroNome} {item.doador?.ultimoNome}</div>
            {item.doador?.telefone ? (
              <div className="text-secondary small mt-1">
                <i className="bi bi-telephone me-1" /> {item.doador.telefone}
              </div>
            ) : (
              !souDono && (
                <div className="text-secondary small mt-1">
                  <i className="bi bi-lock me-1" /> Telefone visível após sua solicitação ser aceita
                </div>
              )
            )}
            {item.endereco && (
              <div className="text-secondary small mt-1">
                <i className="bi bi-house me-1" />
                {item.endereco.logradouro}, {item.endereco.numero} — {item.endereco.bairro}
              </div>
            )}
          </div>

          {!logado && !souDono && item.status === 'disponivel' && (
            <Alert variant="light" className="border">
              <Link to="/entrar" state={{ de: { pathname: `/itens/${item.id}` } }}>Entre</Link> ou{' '}
              <Link to="/registrar">cadastre-se</Link> para solicitar este item.
            </Alert>
          )}

          <div className="d-flex flex-wrap gap-2">
            {logado && !souDono && item.status === 'disponivel' && (
              <Button variant="primary" onClick={() => setModalSolicitar(true)}>
                <i className="bi bi-hand-index-thumb me-1" /> Solicitar este item
              </Button>
            )}
            {logado && !souDono && (
              <Button variant="outline-danger" onClick={() => setModalDenuncia({ tipo: 'item', id: item.id, rotulo: item.titulo })}>
                <i className="bi bi-flag me-1" /> Denunciar item
              </Button>
            )}
            {logado && !souDono && (
              <Button
                variant="outline-secondary"
                onClick={() =>
                  setModalDenuncia({ tipo: 'usuario', id: item.doador.id, rotulo: `${item.doador.primeiroNome} ${item.doador.ultimoNome}` })
                }
              >
                <i className="bi bi-person-x me-1" /> Denunciar doador
              </Button>
            )}

            {souDono && (item.status === 'disponivel' || item.status === 'reservado') && (
              <>
                <Button as={Link} to="/painel/meus-itens" variant="outline-secondary">
                  <i className="bi bi-pencil me-1" /> Editar em Meus Itens
                </Button>
                <Button as={Link} to={`/painel/itens/${item.id}/solicitacoes`} variant="outline-primary">
                  <i className="bi bi-inbox me-1" /> Ver solicitações recebidas
                </Button>
                <Button variant="outline-danger" onClick={() => setModalCancelar(true)}>
                  <i className="bi bi-x-circle me-1" /> Cancelar item
                </Button>
              </>
            )}
          </div>
        </Col>
      </Row>

      <Modal show={modalSolicitar} onHide={() => setModalSolicitar(false)} centered>
        <Form onSubmit={solicitar}>
          <Modal.Header closeButton>
            <Modal.Title as="h5">Solicitar "{item.titulo}"</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form.Group>
              <Form.Label>Mensagem para o doador (opcional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={mensagemSolicitacao}
                onChange={(e) => setMensagemSolicitacao(e.target.value)}
                placeholder="Conte um pouco sobre por que você gostaria de receber este item"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={() => setModalSolicitar(false)} disabled={enviandoSolicitacao}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={enviandoSolicitacao}>
              {enviandoSolicitacao && <Spinner animation="border" size="sm" className="me-2" />}
              Enviar solicitação
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      <DenunciarModal show={Boolean(modalDenuncia)} onHide={() => setModalDenuncia(null)} alvo={modalDenuncia} />

      <ConfirmModal
        show={modalCancelar}
        onHide={() => setModalCancelar(false)}
        onConfirm={cancelarItem}
        carregando={cancelando}
        titulo="Cancelar item"
        mensagem="Isso cancela o anúncio e todas as solicitações pendentes dele. Essa ação não pode ser desfeita."
        textoConfirmar="Cancelar item"
      />
    </Container>
  );
}
