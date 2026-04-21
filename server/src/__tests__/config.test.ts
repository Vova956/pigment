import { describe, it, expect } from 'vitest';
import { config } from '../config';

describe('server config', () => {
  it('exposes a host value', () => {
    expect(typeof config.host).toBe('string');
    expect(config.host.length).toBeGreaterThan(0);
  });

  it('exposes a JWT secret', () => {
    expect(typeof config.jwtSecret).toBe('string');
    expect(config.jwtSecret.length).toBeGreaterThan(0);
  });

  it('uses the expected API port', () => {
    expect(config.apiPort).toBe(3001);
  });

  it('uses the expected WebSocket port', () => {
    expect(config.wsPort).toBe(8080);
  });

  it('references a localhost client URL', () => {
    expect(config.clientUrl).toMatch(/^https?:\/\/.+/);
  });
});
