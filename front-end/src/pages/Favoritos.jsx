import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import { favoritoService } from '../services/favorito.service';
import { mensagemDeErro } from '../services/api';
import ItemCard from '../components/itens/ItemCard';
import FavoritoButton from '../components/itens/FavoritoButton';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import PaginationBar from '../components/common/PaginationBar';

const TAMANHO_PAGINA = 12;

export default function Favoritos() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState({ favoritos: [], total: 0 });
  const [pagina, setPagina] = useState(1);

  async function carregar() {
    setCarregando(true);
    setErro('');
    try {
      setResultado(await favoritoService.listar({ pagina, tamanho: TAMANHO_PAGINA }));
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  function removerDaLista(itemId) {
    setResultado((atual) => ({
      favoritos: atual.favoritos.filter((f) => f.itemId !== itemId),
      total: atual.total - 1,
    }));
  }

  return (
    <div className="mc-fade-in">
      <h2 className="mb-1">Favoritos</h2>
      <p className="text-secondary mb-4">Itens que você salvou para ver depois.</p>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando favoritos..." />
      ) : resultado.favoritos.length === 0 ? (
        <EmptyState
          icone="bi-heart"
          titulo="Nenhum favorito ainda"
          descricao="Salve itens interessantes para encontrá-los rapidamente depois."
          acao={
            <Button as={Link} to="/itens" variant="primary">
              Buscar itens
            </Button>
          }
        />
      ) : (
        <>
          <Row className="g-3">
            {resultado.favoritos.map((f) => (
              <Col key={f.id} sm={6} lg={4} xl={3}>
                <ItemCard
                  item={f.item}
                  mostrarStatus
                  acaoFavorito={<FavoritoButton itemId={f.itemId} favoritado onMudar={() => removerDaLista(f.itemId)} />}
                />
              </Col>
            ))}
          </Row>
          <PaginationBar pagina={pagina} tamanho={TAMANHO_PAGINA} total={resultado.total} onMudarPagina={setPagina} />
        </>
      )}
    </div>
  );
}
