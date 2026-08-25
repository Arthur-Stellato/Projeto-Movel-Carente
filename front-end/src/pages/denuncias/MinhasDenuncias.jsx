import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Table from 'react-bootstrap/Table';
import Alert from 'react-bootstrap/Alert';
import { denunciaService } from '../../services/denuncia.service';
import { mensagemDeErro } from '../../services/api';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import PaginationBar from '../../components/common/PaginationBar';
import { STATUS_DENUNCIA, MOTIVOS_DENUNCIA } from '../../constants';
import { formatarData } from '../../lib/formatadores';

const TAMANHO_PAGINA = 15;

export default function MinhasDenuncias() {
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState({ denuncias: [], total: 0 });
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    let cancelado = false;
    setCarregando(true);
    denunciaService
      .minhas({ pagina, tamanho: TAMANHO_PAGINA })
      .then((data) => !cancelado && setResultado(data))
      .catch((err) => !cancelado && setErro(mensagemDeErro(err)))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [pagina]);

  function rotuloMotivo(motivo) {
    return MOTIVOS_DENUNCIA.find((m) => m.valor === motivo)?.rotulo || motivo;
  }

  return (
    <div className="mc-fade-in">
      <h2 className="mb-1">Minhas denúncias</h2>
      <p className="text-secondary mb-4">Denúncias que você enviou sobre itens ou usuários.</p>

      {erro && <Alert variant="danger">{erro}</Alert>}

      {carregando ? (
        <LoadingSpinner rotulo="Carregando denúncias..." />
      ) : resultado.denuncias.length === 0 ? (
        <EmptyState icone="bi-flag" titulo="Nenhuma denúncia enviada" descricao="Se algo parecer errado num item ou usuário, você pode denunciar direto na página dele." />
      ) : (
        <div className="card">
          <Table responsive hover className="mb-0 align-middle">
            <thead>
              <tr>
                <th>Alvo</th>
                <th>Motivo</th>
                <th>Status</th>
                <th>Enviada em</th>
              </tr>
            </thead>
            <tbody>
              {resultado.denuncias.map((d) => (
                <tr key={d.id}>
                  <td>
                    {d.item ? (
                      <Link to={`/itens/${d.item.id}`} className="text-decoration-none">
                        {d.item.titulo}
                      </Link>
                    ) : (
                      `${d.usuarioDenunciado?.primeiroNome || ''} ${d.usuarioDenunciado?.ultimoNome || ''}`
                    )}
                  </td>
                  <td>{rotuloMotivo(d.motivo)}</td>
                  <td>
                    <StatusBadge mapa={STATUS_DENUNCIA} valor={d.status} />
                  </td>
                  <td className="text-secondary small mc-dado">{formatarData(d.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      <PaginationBar pagina={pagina} tamanho={TAMANHO_PAGINA} total={resultado.total} onMudarPagina={setPagina} />
    </div>
  );
}
