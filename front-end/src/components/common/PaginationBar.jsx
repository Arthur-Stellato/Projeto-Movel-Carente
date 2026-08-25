import Pagination from 'react-bootstrap/Pagination';

export default function PaginationBar({ pagina, tamanho, total, onMudarPagina }) {
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  if (totalPaginas <= 1) return null;

  const paginas = [];
  const inicio = Math.max(1, pagina - 2);
  const fim = Math.min(totalPaginas, inicio + 4);

  for (let p = inicio; p <= fim; p++) {
    paginas.push(p);
  }

  return (
    <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
      <span className="text-secondary small mc-dado">
        {total} {total === 1 ? 'resultado' : 'resultados'} · página {pagina} de {totalPaginas}
      </span>
      <Pagination className="mb-0">
        <Pagination.Prev disabled={pagina <= 1} onClick={() => onMudarPagina(pagina - 1)} />
        {inicio > 1 && (
          <>
            <Pagination.Item onClick={() => onMudarPagina(1)}>1</Pagination.Item>
            {inicio > 2 && <Pagination.Ellipsis disabled />}
          </>
        )}
        {paginas.map((p) => (
          <Pagination.Item key={p} active={p === pagina} onClick={() => onMudarPagina(p)}>
            {p}
          </Pagination.Item>
        ))}
        {fim < totalPaginas && (
          <>
            {fim < totalPaginas - 1 && <Pagination.Ellipsis disabled />}
            <Pagination.Item onClick={() => onMudarPagina(totalPaginas)}>{totalPaginas}</Pagination.Item>
          </>
        )}
        <Pagination.Next disabled={pagina >= totalPaginas} onClick={() => onMudarPagina(pagina + 1)} />
      </Pagination>
    </div>
  );
}
