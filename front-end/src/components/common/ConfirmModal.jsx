import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';

export default function ConfirmModal({
  show,
  onHide,
  onConfirm,
  titulo = 'Confirmar ação',
  mensagem,
  textoConfirmar = 'Confirmar',
  variante = 'danger',
  carregando = false,
}) {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h5">{titulo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>{mensagem}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onHide} disabled={carregando}>
          Cancelar
        </Button>
        <Button variant={variante} onClick={onConfirm} disabled={carregando}>
          {carregando && <Spinner animation="border" size="sm" className="me-2" />}
          {textoConfirmar}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
