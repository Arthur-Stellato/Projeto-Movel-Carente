import { useCallback, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Alert from 'react-bootstrap/Alert';
import { useAuth } from '../../context/AuthContext';
import { avaliacaoService } from '../../services/avaliacao.service';
import { mensagemDeErro } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EstrelasRating from '../../components/common/EstrelasRating';
import EmptyState from '../../components/common/EmptyState';
import { formatarData } from '../../lib/formatadores';

export default function MinhasAvaliacoes() {
  const { usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      // tamanho alto de propósito — é uma lista pessoal, não precisa de
      // paginação de verdade pro volume que uma pessoa física acumula.
      const resultado = await avaliacaoService.recebidasPorUsuario(usuario.id, { tamanho: 50 });
      setDados(resultado);
    } catch (err) {
      setErro(mensagemDeErro(err));
    } finally {
      setCarregando(false);
    }
  }, [usuario.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando) return <LoadingSpinner rotulo="Carregando avaliações..." />;
  if (erro) return <Alert variant="danger">{erro}</Alert>;

  return (
    <div className="mc-fade-in">
      <h2 className="mb-1">Minhas avaliações</h2>
      <p className="text-secondary mb-3">O que doadores e solicitantes disseram sobre negociar com você.</p>

      <div className="mb-4">
        <EstrelasRating media={dados.media} total={dados.total} tamanho="1.4rem" />
      </div>

      {dados.avaliacoes.length === 0 ? (
        <EmptyState
          icone="bi-star"
          titulo="Nenhuma avaliação ainda"
          descricao="Depois que uma doação for concluída, a outra parte pode te avaliar aqui."
        />
      ) : (
        <div className="d-flex flex-column gap-3">
          {dados.avaliacoes.map((a) => (
            <Card key={a.id}>
              <Card.Body>
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <strong>
                    {a.avaliador ? `${a.avaliador.primeiroNome} ${a.avaliador.ultimoNome || ''}` : 'Usuário'}
                  </strong>
                  <span className="text-secondary small mc-dado">{formatarData(a.criadoEm)}</span>
                </div>
                <EstrelasRating media={a.nota} tamanho="0.9rem" mostrarContagem={false} />
                {a.comentario && <p className="mb-0 mt-2">{a.comentario}</p>}
              </Card.Body>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
