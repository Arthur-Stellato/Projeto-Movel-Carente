function origensPermitidas() {
  const envOrigins = process.env.CORS_ORIGIN;
  return envOrigins
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
}

module.exports = { origensPermitidas };

