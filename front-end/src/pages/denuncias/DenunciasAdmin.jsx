import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { denunciaService } from '../../services/denuncia.service';
import { mensagemDeErro } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import PaginationBar from '../../components/common/PaginationBar';
import { STATUS_DENUNCIA, STATUS_ITEM, MOTIVOS_DENUNCIA } from '../../constants';
import { formatarData } from '../../lib/formatadores';

const TAMANHO_PAGINA = 15;

function rotuloMotivo(motivo) {
  return MOTIVOS_DENUNCIA.find((m) => m.valor === motivo)?.rotulo || motivo;
}

// Botão que leva direto pro anúncio (ou indica que é uma denúncia de usuário) —
// sempre em nova aba, pra não fazer o admin perder a posição na lista/filtro
// enquanto vai e volta averiguando o alvo antes de decidir.
function LinkAlvo({ denuncia }) {
  if (denuncia.item) {
    return (
      <Button as={Link} to={`/itens/${denuncia.item.id}`} target="_blank" rel="noopener noreferrer" size="sm" variant="outline-secondary">
        <i className="bi bi-box-arrow-up-right me-1" /> Ver anúncio
      </Button>
    );
  }
  return (
    <span className="text-secondary small">
      <i className="bi bi-person me-1" />
      Denúncia de usuário — sem página pública de perfil
    </span>
  );
}

function AnalisarModal({ denunciaResumo, onHide, onAnalisado }) {
  const { mostrar } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [denuncia, setDenuncia] = useState(denunciaResumo);
  const [status, setStatus] = useState('improcedente');
  const [desativarItem, setDesativarItem] = useState(false);
  const [desativarUsuario, setDesativarUsuario] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    denunciaService
      .buscarPorId(denunciaResumo.id)
      .then(setDenuncia)
      .catch((err) => setErro(mensagemDeErro(err)))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denunciaResumo.id]);

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const atualizada = await denunciaService.analisar(denuncia.id, { status, desativarItem, desativarUsuario });
      onAnalisado(atualizada);
      mostrar('Denúncia analisada.');
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal show onHide={onHide} centered>
      <Form onSubmit={enviar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Analisar denúncia</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <Alert variant="danger">{erro}</Alert>}

          {carregando ? (
            <LoadingSpinner rotulo="Carregando detalhes..." />
          ) : (
            <div className="mb-3 p-3 bg-light rounded">
              <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                <div>
                  <div className="small text-secondary mb-1">Denunciado por</div>
                  <div className="fw-medium">
                    {denuncia.denunciante?.primeiroNome} {denuncia.denunciante?.ultimoNome}
                  </div>
                  <div className="small text-secondary">{denuncia.denunciante?.email}</div>
                </div>
                <div className="text-end">
                  <div className="small text-secondary mb-1">Enviada em</div>
                  <div className="small mc-dado">{formatarData(denuncia.criadoEm)}</div>
                </div>
              </div>

              <hr className="my-2" />

              <div className="small text-secondary mb-1">Alvo</div>
              {denuncia.item ? (
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                  <span className="fw-medium">{denuncia.item.titulo}</span>
                  <StatusBadge mapa={STATUS_ITEM} valor={denuncia.item.status} />
                </div>
              ) : (
                <div className="fw-medium mb-1">
                  {denuncia.usuarioDenunciado?.primeiroNome} {denuncia.usuarioDenunciado?.ultimoNome}
                  {denuncia.usuarioDenunciado?.ativo === false && (
                    <span className="ms-2">
                      <StatusBadge mapa={{ false: { rotulo: 'Conta já desativada', cor: 'tijolo' } }} valor="false" />
                    </span>
                  )}
                </div>
              )}
              <LinkAlvo denuncia={denuncia} />

              <hr className="my-2" />

              <div className="small text-secondary mb-1">Motivo</div>
              <div className="mb-1">{rotuloMotivo(denuncia.motivo)}</div>
              {denuncia.descricao && (
                <>
                  <div className="small text-secondary mb-1 mt-2">Descrição enviada pelo denunciante</div>
                  <div style={{ whiteSpace: 'pre-line' }}>{denuncia.descricao}</div>
                </>
              )}
            </div>
          )}

          <Form.Group className="mb-3">
            <Form.Label>Conclusão</Form.Label>
            <Form.Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="improcedente">Improcedente</option>
              <option value="procedente">Procedente</option>
            </Form.Select>
          </Form.Group>

          {status === 'procedente' && (
            <>
              {denuncia.item && (
                <Form.Check
                  type="checkbox"
                  id="desativar-item"
                  label="Desativar o item denunciado"
                  checked={desativarItem}
                  onChange={(e) => setDesativarItem(e.target.checked)}
                  className="mb-2"
                />
              )}
              {denuncia.usuarioDenunciado && (
                <Form.Check
                  type="checkbox"
                  id="desativar-usuario"
                  label="Desativar a conta denunciada"
                  checked={desativarUsuario}
                  onChange={(e) => setDesativarUsuario(e.target.checked)}
                />
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onHide} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={enviando || carregando}>
            {enviando && <Spinner animation="border" size="sm" className="me-2" />}
            Confirmar análise
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function DenunciasAdmin() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState({ denuncias: [], total: 0 });
  const [pagina, setPagina] = useState(1);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [analisando, setAnalisando] = useState(null);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setResultado(await denunciaService.listarTodas({ status: filtroStatus || undefined, tipo: filtroTipo || undefined, pagina, tamanho: TAMANHO_PAGINA }));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtroStatus, filtroTipo]);

  function aoAnalisar(atualizada) {
    setResultado((atual) => ({ ...atual, denuncias: atual.denuncias.map((d) => (d.id === atualizada.id ? atualizada : d)) }));
    setAnalisando(null);
  }

  return (
    <div className="mc-fade-in">
      <h2 className="mb-1">Denúncias</h2>
      <p className="text-secondary mb-4">Analise as denúncias enviadas pela comunidade.</p>

      <Row className="g-2 mb-3">
        <Col md={3}>
          <Form.Select
            value={filtroStatus}
            onChange={(e) => {
              setFiltroStatus(e.target.value);
              setPagina(1);
            }}
          >
            <option value="">Todos os status</option>
            {Object.entries(STATUS_DENUNCIA).map(([valor, info]) => (
              <option key={valor} value={valor}>
                {info.rotulo}
              </option>
            ))}
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
            <option value="">Item ou usuário</option>
            <option value="item">Item</option>
            <option value="usuario">Usuário</option>
          </Form.Select>
        </Col>
      </Row>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando denúncias..." />
      ) : resultado.denuncias.length === 0 ? (
        <EmptyState icone="bi-shield-check" titulo="Nenhuma denúncia encontrada" />
      ) : (
        <div className="card">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Denunciante</th>
                <th>Alvo</th>
                <th>Motivo</th>
                <th>Status</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {resultado.denuncias.map((d) => (
                <tr key={d.id}>
                  <td className="small">
                    {d.denunciante?.primeiroNome} {d.denunciante?.ultimoNome}
                    <div className="text-secondary">{d.denunciante?.email}</div>
                  </td>
                  <td>
                    <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                      <span>{d.item ? d.item.titulo : `${d.usuarioDenunciado?.primeiroNome || ''} ${d.usuarioDenunciado?.ultimoNome || ''}`}</span>
                      {d.item && <StatusBadge mapa={STATUS_ITEM} valor={d.item.status} />}
                    </div>
                    <LinkAlvo denuncia={d} />
                  </td>
                  <td className="small">{rotuloMotivo(d.motivo)}</td>
                  <td>
                    <StatusBadge mapa={STATUS_DENUNCIA} valor={d.status} />
                  </td>
                  <td className="text-secondary small mc-dado">{formatarData(d.criadoEm)}</td>
                  <td className="text-end">
                    {d.status === 'pendente' && (
                      <Button size="sm" variant="outline-primary" onClick={() => setAnalisando(d)}>
                        Analisar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <PaginationBar pagina={pagina} tamanho={TAMANHO_PAGINA} total={resultado.total} onMudarPagina={setPagina} />

      {analisando && <AnalisarModal denunciaResumo={analisando} onHide={() => setAnalisando(null)} onAnalisado={aoAnalisar} />}
    </div>
  );
}
