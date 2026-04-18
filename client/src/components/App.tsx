import { useState, useEffect } from 'react';
import Canvas from './Canvas';
import HomePage from './HomePage';
import { generateId } from '../types/canvas';

export default function App() {
  // null = not yet decided, '' = home page, 'CODE' = in canvas
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userId] = useState(() => generateId());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('session');
    if (code) {
      // Someone followed a share link — prompt for name before entering
      setPendingCode(code.toUpperCase());
    }
    setSessionId(''); // signal that we've checked the URL
  }, []);

  function handleEnterSession(id: string, name: string) {
    setSessionId(id);
    setUserName(name);
    const url = new URL(window.location.href);
    url.searchParams.set('session', id);
    window.history.pushState({}, '', url.toString());
  }

  // Still reading URL params
  if (sessionId === null) {
    return null;
  }

  if (!sessionId) {
    return <HomePage onEnterSession={handleEnterSession} initialJoinCode={pendingCode} />;
  }

  return <Canvas userId={userId} userName={userName} sessionId={sessionId} />;
}
