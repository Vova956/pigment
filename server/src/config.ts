export const config = {
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
  apiPort: 3001,
  wsPort: 8080,
  clientUrl: 'http://localhost:3000',
};
