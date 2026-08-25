export default function EmptyState({ icone = 'bi-inbox', titulo, descricao, acao }) {
  return (
    <div className="mc-vazio mc-fade-in">
      <i className={`bi ${icone}`} style={{ fontSize: '2.2rem', color: 'var(--mc-verde-700)' }} />
      <h5 className="mt-3 mb-1" style={{ color: 'var(--mc-verde-900)' }}>{titulo}</h5>
      {descricao && <p className="mb-3">{descricao}</p>}
      {acao}
    </div>
  );
}
