export const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'change-me-in-production',
};
  host: "localhost",
  apiPort: 3000,
  wsPort: 8080,
  clientUrl: "http://localhost:5173",
};
