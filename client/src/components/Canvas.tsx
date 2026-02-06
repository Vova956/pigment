import { useEffect, useState } from 'react';
import { config } from '../config';

export default function Canvas() {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(config.websocketUrl);

    socket.onopen = () => {
      console.log('Connected to WebSocket');
      setConnected(true);
    };

    socket.onclose = () => {
      console.log('Disconnected from WebSocket');
      setConnected(false);
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      socket.close();
    };
  }, []);

  return (
    <div>
      <h1>Collaborative Painting</h1>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <svg width="800" height="600" style={{ border: '1px solid black' }}>
        <rect width="800" height="600" fill="white" />
      </svg>
    </div>
  );
}
