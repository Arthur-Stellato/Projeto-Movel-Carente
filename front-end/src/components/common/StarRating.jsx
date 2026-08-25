// Mostra 5 estrelas. Em modo leitura (onChange ausente), só exibe a nota.
// Em modo entrada, cada estrela é um botão que define a nota.
export default function StarRating({ nota = 0, onChange, tamanho = '1.05rem' }) {
  const interativo = Boolean(onChange);
  const estrelas = [1, 2, 3, 4, 5];

  return (
    <div className="mc-estrelas" style={{ fontSize: tamanho }} role={interativo ? 'radiogroup' : undefined} aria-label="Avaliação em estrelas">
      {estrelas.map((valor) =>
        interativo ? (
          <button
            key={valor}
            type="button"
            onClick={() => onChange(valor)}
            aria-label={`${valor} de 5 estrelas`}
            aria-pressed={valor <= nota}
          >
            <i className={`bi ${valor <= nota ? 'bi-star-fill' : 'bi-star'}`} />
          </button>
        ) : (
          <i key={valor} className={`bi ${valor <= nota ? 'bi-star-fill' : 'bi-star'}`} />
        )
      )}
    </div>
  );
}
