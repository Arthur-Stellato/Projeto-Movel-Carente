import { useEffect, useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { avaliacaoService } from '../../services/avaliacao.service';
import { mensagemDeErro } from '../../services/api';
import StarRating from '../common/StarRating';
import LoadingSpinner from '../common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';

export default function AvaliacaoModal({ show, onHide, solicitacaoId }) {
  const { mostrar } = useToast();
  const [carregando, setCarregando] = useState(true);
  const [status, setStatus] = useState(null);
  const [nota, setNota] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!show || !solicitacaoId) return;
    setCarregando(true);
    setErro('');
    setNota(0);
    setComentario('');
    avaliacaoService
      .statusPorSolicitacao(solicitacaoId)
      .then(setStatus)
      .catch((err) => setErro(mensagemDeErro(err)))
      .finally(() => setCarregando(false));
  }, [show, solicitacaoId]);

  async function enviar(evento) {
    evento.preventDefault();
    if (nota === 0) {
      setErro('Escolha uma nota de 1 a 5 estrelas.');
      return;
    }
    setErro('');
    setEnviando(true);
    try {
      const avaliacao = await avaliacaoService.criar(solicitacaoId, { nota, comentario });
      setStatus((atual) => ({ ...atual, minhaAvaliacao: avaliacao }));
      mostrar('Avaliação enviada. Obrigado!');
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">Avaliar doação</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {carregando ? (
          <LoadingSpinner rotulo="Carregando..." />
        ) : (
          <>
            {erro && <Alert variant="danger">{erro}</Alert>}

            {status?.minhaAvaliacao ? (
              <div className="mb-3">
                <div className="text-secondary small mb-1">Sua avaliação</div>
                <StarRating nota={status.minhaAvaliacao.nota} />
                {status.minhaAvaliacao.comentario && <p className="mt-2 mb-0">{status.minhaAvaliacao.comentario}</p>}
              </div>
            ) : (
              <Form onSubmit={enviar}>
                <Form.Group className="mb-3">
                  <Form.Label>Sua nota para a outra parte</Form.Label>
                  <div>
                    <StarRating nota={nota} onChange={setNota} tamanho="1.6rem" />
                  </div>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Comentário (opcional)</Form.Label>
                  <Form.Control as="textarea" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
                </Form.Group>
                <Button type="submit" variant="primary" disabled={enviando}>
                  {enviando && <Spinner animation="border" size="sm" className="me-2" />}
                  Enviar avaliação
                </Button>
              </Form>
            )}

            <hr />

            <div>
              <div className="text-secondary small mb-1">Avaliação da outra parte</div>
              {status?.revelado && status?.avaliacaoRecebida ? (
                <>
                  <StarRating nota={status.avaliacaoRecebida.nota} />
                  {status.avaliacaoRecebida.comentario && <p className="mt-2 mb-0">{status.avaliacaoRecebida.comentario}</p>}
                </>
              ) : (
                <p className="text-secondary small mb-0">
                  <i className="bi bi-eye-slash me-1" />
                  Ainda não revelada. Ela aparece assim que a outra parte avaliar também, ou após 3 dias da primeira avaliação — o que vier primeiro.
                </p>
              )}
            </div>
          </>
        )}
      </Modal.Body>
    </Modal>
  );
}
