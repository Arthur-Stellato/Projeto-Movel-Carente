import { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import { denunciaService } from '../../services/denuncia.service';
import { mensagemDeErro } from '../../services/api';
import { MOTIVOS_DENUNCIA } from '../../constants';
import { useToast } from '../../context/ToastContext';

// alvo: { tipo: 'item' | 'usuario', id: string, rotulo: string }
export default function DenunciarModal({ show, onHide, alvo }) {
  const { mostrar } = useToast();
  const [motivo, setMotivo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  function limparEFechar() {
    setMotivo('');
    setDescricao('');
    setErro('');
    onHide();
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await denunciaService.criar({
        tipo: alvo.tipo,
        motivo,
        descricao: descricao || undefined,
        ...(alvo.tipo === 'item' ? { itemId: alvo.id } : { usuarioDenunciadoId: alvo.id }),
      });
      mostrar('Denúncia enviada. Nossa equipe vai analisar.');
      limparEFechar();
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal show={show} onHide={limparEFechar} centered>
      <Form onSubmit={enviar}>
        <Modal.Header closeButton>
          <Modal.Title as="h5">Denunciar {alvo?.tipo === 'usuario' ? 'usuário' : 'item'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {erro && <Alert variant="danger">{erro}</Alert>}
          {alvo?.rotulo && <p className="text-secondary small">Você está denunciando: <strong>{alvo.rotulo}</strong></p>}

          <Form.Group className="mb-3">
            <Form.Label>Motivo</Form.Label>
            <Form.Select value={motivo} onChange={(e) => setMotivo(e.target.value)} required>
              <option value="">Selecione...</option>
              {MOTIVOS_DENUNCIA.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.rotulo}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group>
            <Form.Label>Descrição (opcional)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={2000}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Dê detalhes que ajudem nossa equipe a analisar"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={limparEFechar} disabled={enviando}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={enviando}>
            {enviando && <Spinner animation="border" size="sm" className="me-2" />}
            Enviar denúncia
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
