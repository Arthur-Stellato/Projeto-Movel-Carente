function origensPermitidas() {
  const envOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:5173';
  return envOrigins
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
}

module.exports = { origensPermitidas };

