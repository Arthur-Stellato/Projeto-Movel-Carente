// Marca da MóvelCarente: uma caixa de mudança com um recorte de coração —
// o gesto central da plataforma (doar itens de casa) resumido num ícone só.
export default function BrandMark({ tamanho = 26 }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4 12.5 16 6l12 6.5V25a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 6 25V12.5Z" fill="currentColor" opacity="0.16" />
      <path d="M4 12.5 16 6l12 6.5M6 11.3V25a1.5 1.5 0 0 0 1.5 1.5h17A1.5 1.5 0 0 0 26 25V11.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 16.2c-2.6-2.7-6.4-.6-6.4 2 0 2.4 3.6 4.9 6.4 6.8 2.8-1.9 6.4-4.4 6.4-6.8 0-2.6-3.8-4.7-6.4-2Z" fill="currentColor" />
    </svg>
  );
}
