import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import { itemService } from '../services/item.service';
import ItemCard from '../components/itens/ItemCard';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { logado } = useAuth();
  const [recentes, setRecentes] = useState([]);

  useEffect(() => {
    itemService
      .listar({ tamanho: 4 })
      .then((data) => setRecentes(data.itens))
      .catch(() => {});
  }, []);

  return (
    <>
      <section style={{ background: 'var(--mc-verde-900)', color: '#fff' }} className="py-5">
        <Container className="py-5">
          <Row className="align-items-center g-4">
            <Col lg={7}>
              <h1 className="mc-display mb-3" style={{ color: '#fff', fontSize: '2.6rem' }}>
                Dê uma segunda vida aos móveis da sua casa
              </h1>
              <p className="mb-4" style={{ color: 'rgba(238,244,240,0.85)', fontSize: '1.1rem' }}>
                A MóvelCarente conecta quem tem itens de casa para doar com quem precisa deles —
                de forma simples, direta e sem custo.
              </p>
              <div className="d-flex gap-2 flex-wrap">
                <Button as={Link} to="/itens" variant="warning" size="lg">
                  Buscar itens
                </Button>
                {!logado && (
                  <Button as={Link} to="/registrar" variant="outline-light" size="lg">
                    Quero doar
                  </Button>
                )}
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      <Container className="py-5">
        <div className="d-flex justify-content-between align-items-end mb-4">
          <h3 className="mb-0">Anunciados recentemente</h3>
          <Link to="/itens">Ver todos</Link>
        </div>
        <Row className="g-3">
          {recentes.map((item) => (
            <Col key={item.id} sm={6} lg={3}>
              <ItemCard item={item} />
            </Col>
          ))}
        </Row>
      </Container>
    </>
  );
}
