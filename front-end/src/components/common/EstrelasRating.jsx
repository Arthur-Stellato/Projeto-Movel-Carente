// Renderiza a média em estrelas (cheia/meia/vazia) + contagem opcional.
// media pode vir null (usuário sem nenhuma avaliação revelada ainda) — nesse
// caso mostra uma mensagem neutra em vez de "0 estrelas", que pareceria uma
// avaliação ruim em vez de "ainda não avaliado".
export default function EstrelasRating({ media, total, tamanho = '1rem', mostrarContagem = true }) {
  if (media === null || media === undefined) {
    return <span className="text-secondary small">Ainda sem avaliações</span>;
  }

  const estrelas = [];
  for (let i = 1; i <= 5; i += 1) {
    let icone = 'bi-star'; // vazia
    if (media >= i) icone = 'bi-star-fill'; // cheia
    else if (media >= i - 0.5) icone = 'bi-star-half'; // meia
    estrelas.push(<i key={i} className={`bi ${icone}`} style={{ color: 'var(--mc-ocre-600)', fontSize: tamanho }} />);
  }

  return (
    <span className="d-inline-flex align-items-center gap-1">
      <span className="d-inline-flex gap-1">{estrelas}</span>
      {mostrarContagem && (
        <span className="text-secondary small">
          {media.toFixed(1)} ({total} {total === 1 ? 'avaliação' : 'avaliações'})
        </span>
      )}
    </span>
  );
}
