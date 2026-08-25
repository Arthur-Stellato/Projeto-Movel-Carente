import Card from 'react-bootstrap/Card';
import Badge from 'react-bootstrap/Badge';
import { Link } from 'react-router-dom';
import { resolverUrlImagem } from '../../services/api';
import StatusBadge from '../common/StatusBadge';
import { STATUS_ITEM, CONDICOES_ITEM } from '../../constants';

export default function ItemCard({ item, acaoFavorito, mostrarStatus = false }) {
  const primeiraImagem = item.imagens?.[0];
  const condicao = CONDICOES_ITEM.find((c) => c.valor === item.condicao)?.rotulo || item.condicao;

  return (
    <Card className="mc-item-card mc-fade-in position-relative">
      {acaoFavorito && <div className="position-absolute top-0 end-0 m-2" style={{ zIndex: 2 }}>{acaoFavorito}</div>}

      <Link to={`/itens/${item.id}`} className="text-decoration-none text-reset">
        {primeiraImagem ? (
          <Card.Img variant="top" src={resolverUrlImagem(primeiraImagem.url)} className="mc-item-card__imagem" alt={item.titulo} />
        ) : (
          <div className="mc-item-card__placeholder">
            <i className="bi bi-image" />
          </div>
        )}
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start gap-2 mb-1">
            <Card.Title as="h6" className="mb-0 text-truncate" style={{ color: 'var(--mc-tinta)' }}>
              {item.titulo}
            </Card.Title>
          </div>
          <div className="d-flex flex-wrap gap-1 mb-2">
            {item.categoria && (
              <Badge bg="light" text="dark" className="border">
                {item.categoria.icone && <i className={`bi ${item.categoria.icone} me-1`} />}
                {item.categoria.nome}
              </Badge>
            )}
            <Badge bg="light" text="dark" className="border">
              {condicao}
            </Badge>
            {mostrarStatus && <StatusBadge mapa={STATUS_ITEM} valor={item.status} />}
          </div>
          <div className="small text-secondary d-flex align-items-center gap-1">
            <i className="bi bi-geo-alt" /> {item.cidade}/{item.estado}
          </div>
        </Card.Body>
      </Link>
    </Card>
  );
}
