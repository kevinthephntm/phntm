export type Phase =
  | 'idle'
  | 'calling'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'done'
  | 'stopped'
  | 'error';

export type AgentEvent = {
  type: 'status' | 'action' | 'message' | 'facetime' | 'heard';
  text: string;
};

export type State = {
  phase: Phase;
  inCall: boolean;
  task: string;
  step: string;
  steps: number;
  caption: string;
  captionAt: number;
  touched: number;
  activity: { text: string; time: number; type: AgentEvent['type'] }[];
};

export type Action =
  | { kind: 'event'; ev: AgentEvent; now: number }
  | { kind: 'submitted'; text: string }
  | { kind: 'tick'; now: number };

export const LABEL: Record<Phase, string> = {
  idle: 'ready when you are',
  calling: 'ringing your iphone',
  listening: 'all ears',
  thinking: 'lemme think',
  working: 'cooking',
  done: 'all done, ate',
  stopped: 'stopped',
  error: 'need you rq',
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
  space: 'Space',
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

export function isAgentEvent(value: unknown): value is AgentEvent {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    'text' in value &&
    typeof value.text === 'string' &&
    ['status', 'action', 'message', 'facetime', 'heard'].includes(
      String(value.type),
    )
  );
}

export function describe(action: string): string {
  const i = action.indexOf(' ');
  const kind = i === -1 ? action : action.slice(0, i);
  const rest = i === -1 ? '' : action.slice(i + 1);
  let args: { text?: unknown; keys?: unknown } = {};
  if (rest.startsWith('{')) {
    try {
      args = JSON.parse(rest) ?? {};
    } catch {
      return 'reading the next move';
    }
  }
  switch (kind) {
    case 'click':
      return 'clicking';
    case 'double_click':
      return 'double-clicking';
    case 'type':
      return `typing “${typeof args.text === 'string' ? args.text : ''}”`;
    case 'keypress':
      return `pressing ${(Array.isArray(args.keys) ? args.keys : [])
        .filter((key): key is string => typeof key === 'string')
        .map((key) => KEYS[key.toLowerCase()] ?? key.toUpperCase())
        .join('')}`;
    case 'scroll':
      return 'scrolling';
    case 'drag':
      return 'dragging';
    case 'move':
      return 'moving the cursor';
    case 'wait':
      return 'waiting on the screen';
    case 'screenshot':
      return 'peeping the screen';
    case 'open_app':
      return `opening ${rest}`;
    case 'open_url':
      return `opening ${rest.replace(/^https?:\/\//, '').split('/')[0]}`;
    default:
      return action;
  }
}

export const initial: State = {
  phase: 'idle',
  inCall: false,
  task: '',
  step: '',
  steps: 0,
  caption: '',
  captionAt: 0,
  touched: 0,
  activity: [],
};

export function reduce(s: State, a: Action): State {
  if (a.kind === 'submitted') return { ...s, task: a.text };
  if (a.kind === 'tick') {
    const caption = a.now - s.captionAt >= 10000 ? '' : s.caption;
    if (
      (s.phase === 'done' || s.phase === 'stopped') &&
      a.now - s.touched >= 6000
    ) {
      return {
        ...s,
        phase: s.inCall ? 'listening' : 'idle',
        task: '',
        step: '',
        steps: 0,
        caption,
      };
    }
    return caption === s.caption ? s : { ...s, caption };
  }
  const { ev, now } = a;
  const t = ev.text;
  const next = eventState(s, ev, now);
  if (next === s || !t.trim()) return next;
  const text = ev.type === 'action' ? describe(t) : t;
  return {
    ...next,
    activity: [...s.activity, { text, time: now, type: ev.type }].slice(-24),
  };
}

function eventState(s: State, ev: AgentEvent, now: number): State {
  const t = ev.text;
  switch (ev.type) {
    case 'heard':
      return t.trim() ? { ...s, caption: t, captionAt: now } : s;
    case 'facetime':
      return { ...s, phase: 'calling', inCall: true, step: '', touched: now };
    case 'message':
      if (t.startsWith('task: ') || t.startsWith('task from iMessage: ')) {
        const task = t.slice(t.indexOf(': ') + 2);
        return {
          ...s,
          phase: 'thinking',
          task,
          step: '',
          steps: 0,
          touched: now,
        };
      }
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
        return { ...s, phase: 'thinking', steps: 0, step: '', touched: now };
      if (t === 'done') return { ...s, phase: 'done', touched: now };
      if (t.startsWith('stopped'))
        return {
          ...s,
          phase: 'stopped',
          step: t === 'stopped' ? '' : t,
          touched: now,
        };
      if (
        t.startsWith('error') ||
        t.startsWith('call failed') ||
        t.startsWith('iMessage watch off')
      ) {
        return {
          ...s,
          phase: 'error',
          inCall: t.startsWith('call failed') ? false : s.inCall,
          step: t,
          touched: now,
        };
      }
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
      if (t === 'call ended') {
        const busy = s.phase === 'thinking' || s.phase === 'working';
        return {
          ...s,
          phase: busy ? s.phase : 'idle',
          inCall: false,
          caption: '',
          step: busy ? s.step : '',
          touched: now,
        };
      }
      if (t.startsWith('watching iMessage')) return s;
      return s;
  }
}
