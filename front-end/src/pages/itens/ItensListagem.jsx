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
  const [cidadeTexto, setCidadeTexto] = useState('');
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

  // Mesma lógica pro campo de cidade — 300ms, um pouco mais curto que o de
  // busca textual porque nomes de cidade tendem a ser mais curtos de digitar.
  useEffect(() => {
    const temporizador = setTimeout(() => {
      setFiltros((atual) => ({ ...atual, cidade: cidadeTexto }));
      setPagina(1);
    }, 300);
    return () => clearTimeout(temporizador);
  }, [cidadeTexto]);

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
        if (!cancelado) {
          // Mesma lógica do fix em Conversas.jsx: sem isso, não tem como saber
          // se isso é erro de rede, validação rejeitada pelo Joi, ou uma
          // exceção de JS — a tela mostra só a mensagem genérica de sempre.
          console.error('[ItensListagem] Falha ao buscar itens:', err);
          setErro(mensagemDeErro(err));
        }
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
      (erroGeo) => {
        // GeolocationPositionError.code: 1 = permissão negada, 2 = posição
        // indisponível, 3 = tempo esgotado — vale diferenciar a mensagem do
        // caso mais comum (usuário clicou em "bloquear") dos demais.
        const mensagem =
          erroGeo.code === 1
            ? 'Permissão de localização negada. Você pode habilitar isso nas configurações do navegador.'
            : 'Não foi possível obter sua localização no momento. Tente novamente.';
        setErro(mensagem);
        setBuscandoLocalizacao(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 5 * 60 * 1000 }
    );
  }

  function atualizarRaio(raioKm) {
    setGeo((atual) => (atual ? { ...atual, raioKm: Number(raioKm) } : atual));
    setPagina(1);
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
          <Form.Control value={cidadeTexto} onChange={(e) => setCidadeTexto(e.target.value)} />
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
      {geo && (
        <div className="d-flex align-items-center gap-2 mb-3">
          <span className="small text-secondary">Raio de busca:</span>
          <Form.Select
            size="sm"
            style={{ width: 'auto' }}
            value={geo.raioKm}
            onChange={(e) => atualizarRaio(e.target.value)}
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
          </Form.Select>
          <span className="small text-secondary">da sua localização atual.</span>
        </div>
      )}

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
