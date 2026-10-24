import { useEffect, useReducer, useRef, useState } from 'react';

const API = 'http://127.0.0.1:8000';
const RESULT_TTL_MS = 6000;

type Event = {
  type: 'status' | 'action' | 'message' | 'facetime' | 'heard';
  text: string;
};
type Phase =
  | 'idle'
  | 'calling'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'done'
  | 'stopped'
  | 'error';

type State = {
  phase: Phase;
  inCall: boolean;
  step: string;
  steps: number;
  touched: number;
};
type Action =
  | { kind: 'event'; ev: Event; now: number }
  | { kind: 'tick'; now: number };

const LABEL: Record<Phase, string> = {
  idle: 'Idle',
  calling: 'Calling',
  listening: 'Listening',
  thinking: 'Thinking',
  working: 'Working',
  done: 'Done',
  stopped: 'Stopped',
  error: 'Error',
};

const KEYS: Record<string, string> = {
  cmd: '⌘',
  command: '⌘',
  super: '⌘',
  meta: '⌘',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  ctrl: '⌃',
  control: '⌃',
  enter: '↩',
  return: '↩',
  esc: '⎋',
  escape: '⎋',
  space: '␣',
  tab: '⇥',
  backspace: '⌫',
  delete: '⌦',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

function describe(action: string): string {
  const i = action.indexOf(' ');
  const kind = i === -1 ? action : action.slice(0, i);
  const rest = i === -1 ? '' : action.slice(i + 1);
  const args = rest.startsWith('{')
    ? (JSON.parse(rest) as { text?: string; keys?: string[] })
    : {};
  switch (kind) {
    case 'click':
      return 'Clicking';
    case 'double_click':
      return 'Double-clicking';
    case 'type':
      return `Typing “${args.text ?? ''}”`;
    case 'keypress':
      return `Pressing ${(args.keys ?? []).map((k) => KEYS[k.toLowerCase()] ?? k.toUpperCase()).join('')}`;
    case 'scroll':
      return 'Scrolling';
    case 'drag':
      return 'Dragging';
    case 'move':
      return 'Moving the cursor';
    case 'wait':
      return 'Waiting for the screen';
    case 'screenshot':
      return 'Looking at the screen';
    case 'open_app':
      return `Opening ${rest}`;
    case 'open_url':
      return `Opening ${rest.replace(/^https?:\/\//, '').split('/')[0]}`;
    default:
      return action;
  }
}

const initial: State = {
  phase: 'idle',
  inCall: false,
  step: '',
  steps: 0,
  touched: 0,
};

function reduce(s: State, a: Action): State {
  if (a.kind === 'tick') {
    const resting = s.phase === 'done' || s.phase === 'stopped';
    if (resting && a.now - s.touched > RESULT_TTL_MS)
      return {
        ...s,
        phase: s.inCall ? 'listening' : 'idle',
        step: '',
        steps: 0,
      };
    return s;
  }
  const { ev, now } = a;
  const t = ev.text;
  switch (ev.type) {
    case 'heard':
      return s;
    case 'facetime':
      return { ...s, phase: 'calling', step: '', touched: now };
    case 'message':
      if (t.startsWith('task: ') || t.startsWith('task from iMessage: '))
        return {
          ...s,
          phase: 'thinking',
          step: t.slice(t.indexOf(': ') + 2),
          steps: 0,
          touched: now,
        };
      return { ...s, step: t, touched: now };
    case 'action':
      return {
        ...s,
        phase: 'working',
        step: describe(t),
        steps: s.steps + 1,
        touched: now,
      };
    case 'status':
      if (t === 'running')
        return { ...s, phase: 'thinking', steps: 0, touched: now };
      if (t === 'done') return { ...s, phase: 'done', touched: now };
      if (t.startsWith('stopped'))
        return { ...s, phase: 'stopped', step: '', touched: now };
      if (
        t.startsWith('error') ||
        t.startsWith('call failed') ||
        t.startsWith('iMessage watch off')
      )
        return { ...s, phase: 'error', step: t, touched: now };
      if (t.startsWith('calling'))
        return { ...s, phase: 'calling', inCall: true, step: '', touched: now };
      if (t === 'listening on the FaceTime call')
        return {
          ...s,
          phase: 'listening',
          inCall: true,
          step: '',
          touched: now,
        };
      if (t === 'call ended')
        return { ...s, phase: 'idle', inCall: false, step: '', touched: now };
      if (t.startsWith('watching iMessage'))
        return { ...s, phase: 'idle', touched: now };
      return s;
  }
}

export function App() {
  const [s, dispatch] = useReducer(reduce, initial);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const busy = s.phase === 'thinking' || s.phase === 'working';

  useEffect(() => {
    const es = new EventSource(`${API}/events`);
    es.onmessage = (e) =>
      dispatch({
        kind: 'event',
        ev: JSON.parse(e.data) as Event,
        now: Date.now(),
      });
    const timer = setInterval(
      () => dispatch({ kind: 'tick', now: Date.now() }),
      1000,
    );
    return () => {
      es.close();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const el = root.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      window.bar.resize(r.width, r.height);
    });
    ro.observe(el);
    const focus = () => setEditing(true);
    const blur = () => setEditing(false);
    window.addEventListener('focus', focus);
    window.addEventListener('blur', blur);
    return () => {
      ro.disconnect();
      window.removeEventListener('focus', focus);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => window.bar.phase(s.phase), [s.phase]);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await fetch(`${API}/task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    setText('');
  };

  const stop = () => fetch(`${API}/stop`, { method: 'POST' });

  const escape = () => {
    if (busy) stop();
    window.bar.blur();
  };

  const label =
    busy && s.steps > 0 ? `${LABEL[s.phase]} · ${s.steps}` : LABEL[s.phase];

  return (
    <div className="island" ref={root}>
      <span className={`dot ${s.phase}`} />
      <span className="label">{label}</span>
      {s.step && <span className="step">{s.step}</span>}
      {editing && !s.inCall && (
        <form onSubmit={run}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && escape()}
            placeholder={busy ? 'Type to take over' : 'Ask for something'}
            autoFocus
          />
        </form>
      )}
      {busy && (
        <button type="button" className="stop" onClick={stop}>
          Stop
        </button>
      )}
    </div>
  );
}
