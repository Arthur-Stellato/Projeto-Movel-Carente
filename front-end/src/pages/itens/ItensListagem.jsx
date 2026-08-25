import { useEffect, useState } from 'react';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Alert from 'react-bootstrap/Alert';
import { itemService } from '../../services/item.service';
import { categoriaService } from '../../services/categoria.service';
import { favoritoService } from '../../services/favorito.service';
import { mensagemDeErro } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ItemCard from '../../components/itens/ItemCard';
import FavoritoButton from '../../components/itens/FavoritoButton';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import PaginationBar from '../../components/common/PaginationBar';
import { UFS } from '../../constants';

const TAMANHO_PAGINA = 12;

export default function ItensListagem() {
  const { logado } = useAuth();
  const [categorias, setCategorias] = useState([]);
  const [buscaTexto, setBuscaTexto] = useState('');
  const [filtros, setFiltros] = useState({ categoriaId: '', cidade: '', estado: '', busca: '' });
  const [geo, setGeo] = useState(null); // { lat, lng, raioKm }
  const [buscandoLocalizacao, setBuscandoLocalizacao] = useState(false);
  const [pagina, setPagina] = useState(1);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState({ itens: [], total: 0 });
  const [favoritosIds, setFavoritosIds] = useState(new Set());

  useEffect(() => {
    categoriaService.listar().then(setCategorias).catch(() => setCategorias([]));
  }, []);

  useEffect(() => {
    if (!logado) {
      setFavoritosIds(new Set());
      return;
    }
    favoritoService
      .listar({ tamanho: 100 })
      .then((data) => setFavoritosIds(new Set(data.favoritos.map((f) => f.itemId))))
      .catch(() => {});
  }, [logado]);

  // Debounce da busca textual — evita disparar uma requisição a cada tecla.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setFiltros((atual) => ({ ...atual, busca: buscaTexto }));
      setPagina(1);
    }, 400);
    return () => clearTimeout(temporizador);
  }, [buscaTexto]);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    setErro('');
    const parametros = {
      pagina,
      tamanho: TAMANHO_PAGINA,
      categoriaId: filtros.categoriaId || undefined,
      cidade: filtros.cidade || undefined,
      estado: filtros.estado || undefined,
      busca: filtros.busca || undefined,
      ...(geo ? { lat: geo.lat, lng: geo.lng, raioKm: geo.raioKm } : {}),
    };
    itemService
      .listar(parametros)
      .then((data) => {
        if (!cancelado) setResultado(data);
      })
      .catch((err) => {
        if (!cancelado) setErro(mensagemDeErro(err));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [filtros, geo, pagina]);

  function atualizarFiltro(campo, valor) {
    setFiltros((atual) => ({ ...atual, [campo]: valor }));
    setPagina(1);
  }

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) {
      setErro('Seu navegador não suporta geolocalização.');
      return;
    }
    setBuscandoLocalizacao(true);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        setGeo({ lat: posicao.coords.latitude, lng: posicao.coords.longitude, raioKm: 25 });
        setPagina(1);
        setBuscandoLocalizacao(false);
      },
      () => {
        setErro('Não foi possível obter sua localização. Verifique a permissão do navegador.');
        setBuscandoLocalizacao(false);
      }
    );
  }

  function marcarFavorito(itemId, valor) {
    setFavoritosIds((atual) => {
      const novo = new Set(atual);
      if (valor) novo.add(itemId);
      else novo.delete(itemId);
      return novo;
    });
  }

  return (
    <Container className="py-4">
      <div className="mb-4">
        <h2 className="mb-1">Encontre itens perto de você</h2>
        <p className="text-secondary mb-0">Móveis, eletrodomésticos e outros itens disponíveis para doação.</p>
      </div>

      <Row className="g-2 mb-2 align-items-end">
        <Col md={4}>
          <Form.Label className="small">Buscar</Form.Label>
          <Form.Control
            placeholder="Ex: sofá, geladeira, guarda-roupa..."
            value={buscaTexto}
            onChange={(e) => setBuscaTexto(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Label className="small">Categoria</Form.Label>
          <Form.Select value={filtros.categoriaId} onChange={(e) => atualizarFiltro('categoriaId', e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={2}>
          <Form.Label className="small">Cidade</Form.Label>
          <Form.Control value={filtros.cidade} onChange={(e) => atualizarFiltro('cidade', e.target.value)} />
        </Col>
        <Col md={1}>
          <Form.Label className="small">UF</Form.Label>
          <Form.Select value={filtros.estado} onChange={(e) => atualizarFiltro('estado', e.target.value)}>
            <option value="">-</option>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </Form.Select>
        </Col>
        <Col md={2}>
          <Button variant={geo ? 'warning' : 'outline-secondary'} className="w-100" onClick={geo ? () => setGeo(null) : usarMinhaLocalizacao} disabled={buscandoLocalizacao}>
            <i className="bi bi-geo-alt me-1" />
            {geo ? 'Perto de mim ✓' : 'Perto de mim'}
          </Button>
        </Col>
      </Row>
      {geo && <p className="small text-secondary">Mostrando itens num raio de {geo.raioKm}km da sua localização.</p>}

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Buscando itens..." />
      ) : resultado.itens.length === 0 ? (
        <EmptyState icone="bi-search" titulo="Nenhum item encontrado" descricao="Tente ajustar os filtros de busca." />
      ) : (
        <>
          <Row className="g-3">
            {resultado.itens.map((item) => (
              <Col key={item.id} sm={6} lg={4} xl={3}>
                <ItemCard
                  item={item}
                  acaoFavorito={
                    logado && (
                      <FavoritoButton itemId={item.id} favoritado={favoritosIds.has(item.id)} onMudar={marcarFavorito} />
                    )
                  }
                />
              </Col>
            ))}
          </Row>
          <PaginationBar pagina={pagina} tamanho={TAMANHO_PAGINA} total={resultado.total} onMudarPagina={setPagina} />
        </>
      )}
    </Container>
  );
}
