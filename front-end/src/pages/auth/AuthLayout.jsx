import { Link } from 'react-router-dom';
import BrandMark from '../../components/common/BrandMark';

export default function AuthLayout({ titulo, subtitulo, children }) {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh', background: 'var(--mc-verde-900)' }}>
      <div className="w-100 p-3" style={{ maxWidth: 460 }}>
        <Link to="/" className="mc-marca justify-content-center mb-4 d-flex" style={{ color: '#fff' }}>
          <BrandMark />
          MóvelCarente
        </Link>
        <div className="card p-4 p-md-5 mc-fade-in">
          <h3 className="mb-1">{titulo}</h3>
          {subtitulo && <p className="text-secondary mb-4">{subtitulo}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
