import { isAgentEvent, type AgentEvent } from './state';

export type Connection = 'connecting' | 'connected' | 'offline';
export interface Transport {
  subscribe: (
    onEvent: (event: AgentEvent) => void,
    onConnection: (connection: Connection) => void,
  ) => () => void;
  run: (text: string) => Promise<void>;
  stop: () => Promise<void>;
}

const API = 'http://127.0.0.1:8000';

async function post(path: string, text?: string) {
  const response = await fetch(`${API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: text === undefined ? undefined : JSON.stringify({ text }),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error('Request failed');
}

export const liveTransport: Transport = {
  subscribe(onEvent, onConnection) {
    const source = new EventSource(`${API}/events`);
    onConnection('connecting');
    source.onopen = () => onConnection('connected');
    source.onerror = () => onConnection('offline');
    source.onmessage = (event) => {
      try {
        const value: unknown = JSON.parse(event.data);
        if (isAgentEvent(value)) onEvent(value);
      } catch {
        onConnection('offline');
      }
    };
    return () => source.close();
  },
  run: (text) => post('task', text),
  stop: () => post('stop'),
};
