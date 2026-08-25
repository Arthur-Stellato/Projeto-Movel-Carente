export default function StatusBadge({ mapa, valor }) {
  const info = mapa[valor] || { rotulo: valor, cor: 'neutro' };
  return <span className={`mc-badge mc-badge--${info.cor}`}>{info.rotulo}</span>;
}
