import { useState, useEffect } from 'react';
import Canvas from './Canvas';
import HomePage from './HomePage';
import { generateId } from '../types/canvas';

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userId] = useState(() => generateId());

  // On mount, check URL for ?session=CODE
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('session');
    if (code) setSessionId(code.toUpperCase());
  }, []);

  function handleEnterSession(id: string, name: string) {
    setSessionId(id);
    setUserName(name);
    // Update URL so the link is shareable
    const url = new URL(window.location.href);
    url.searchParams.set('session', id);
    window.history.pushState({}, '', url.toString());
  }

  if (!sessionId) {
    return <HomePage onEnterSession={handleEnterSession} />;
  }

  return (
    <Canvas
      userId={userId}
      userName={userName || 'Guest'}
      sessionId={sessionId}
    />
  );
}
