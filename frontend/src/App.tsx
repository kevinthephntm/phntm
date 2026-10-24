import {
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Icon } from './Icon';
import { initial, LABEL, reduce } from './state';
import { liveTransport, type Connection, type Transport } from './transport';

const suggestions = [
  {
    title: 'fresh start era',
    text: 'open notes and start a new note for today.',
    icon: 'arrow' as const,
  },
  {
    title: 'what’s the plan',
    text: 'open calendar and show me this week.',
    icon: 'history' as const,
  },
];

export function App({
  transport = liveTransport,
  preview = false,
}: {
  transport?: Transport;
  preview?: boolean;
}) {
  const [s, dispatch] = useReducer(reduce, initial);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState(preview);
  const [history, setHistory] = useState(false);
  const [help, setHelp] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [reconnect, setReconnect] = useState(0);
  const [pending, setPending] = useState<'run' | 'stop' | null>(null);
  const [error, setError] = useState('');
  const [dismissedAt, setDismissedAt] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const request = useRef(false);
  const busy = s.phase === 'thinking' || s.phase === 'working';
  const expanded =
    editing ||
    Boolean(s.caption && s.captionAt > dismissedAt) ||
    (s.phase === 'error' && s.touched > dismissedAt);
  const online = connection === 'connected';
  const status = online
    ? LABEL[s.phase]
    : connection === 'connecting'
      ? 'connecting…'
      : 'lost the connection';

  useEffect(() => {
    return transport.subscribe(
      (ev) => dispatch({ kind: 'event', ev, now: Date.now() }),
      setConnection,
    );
  }, [transport, reconnect]);

  useEffect(() => {
    const timer = setInterval(
      () => dispatch({ kind: 'tick', now: Date.now() }),
      500,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (preview) return;
    const ro = new ResizeObserver(() => {
      const r = root.current!.getBoundingClientRect();
      window.bar?.resize(
        r.width,
        r.height,
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      );
    });
    ro.observe(root.current!);
    const focus = () => setEditing(true);
    const blur = () => setEditing(false);
    window.addEventListener('focus', focus);
    window.addEventListener('blur', blur);
    return () => {
      ro.disconnect();
      window.removeEventListener('focus', focus);
      window.removeEventListener('blur', blur);
    };
  }, [preview]);

  useEffect(() => {
    window.bar?.phase(online ? s.phase : 'idle');
  }, [s.phase, online]);

  useEffect(() => {
    if (editing && !s.inCall && !history)
      input.current?.focus({ preventScroll: true });
  }, [editing, s.inCall, history]);

  const send = async (kind: 'run' | 'stop') => {
    if (request.current || (kind === 'run' && (!text.trim() || !online)))
      return;
    request.current = true;
    setPending(kind);
    setError('');
    try {
      if (kind === 'run') {
        const submitted = text.trim();
        await transport.run(submitted);
        dispatch({ kind: 'submitted', text: submitted });
        setText((current) => (current.trim() === submitted ? '' : current));
      } else {
        await transport.stop();
      }
    } catch {
      setEditing(true);
      setError(
        kind === 'stop'
          ? 'stop didn’t go through. check the backend connection and try again.'
          : 'task didn’t go through. your draft’s saved here, peep the activity before you retry.',
      );
    } finally {
      request.current = false;
      setPending(null);
    }
  };

  const collapse = () => {
    setEditing(false);
    setHistory(false);
    setHelp(false);
    setDismissedAt(Date.now());
    if (preview) toggle.current?.focus({ preventScroll: true });
    else window.bar?.blur();
  };

  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      if (preview && !root.current?.contains(event.target as Node)) return;
      event.preventDefault();
      if (busy) void send('stop');
      collapse();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  });

  return (
    <div
      className={`island-wrap ${expanded ? 'is-expanded' : ''}`}
      data-phase={s.phase}
      data-connection={connection}
      ref={root}
      style={
        {
          '--screen-width': `${window.screen.availWidth - 32}px`,
          '--screen-height': `${window.screen.availHeight - 48}px`,
        } as CSSProperties
      }
    >
      {expanded && (
        <main className="panel" aria-label="phntm assistant">
          <header className="panel-header">
            <div className="brand">
              <Icon name="ghost" />
              <span>
                phntm<span className="brand-period">.</span>
              </span>
            </div>
            <div className="header-controls">
              <span className="connection">
                <span className="connection-dot" />
                {online
                  ? 'on your mac'
                  : connection === 'connecting'
                    ? 'connecting'
                    : 'offline'}
              </span>
              <button
                className="icon-button"
                type="button"
                aria-label={history ? 'back to task' : 'show session activity'}
                aria-pressed={history}
                onClick={() => setHistory(!history)}
                title="session activity"
              >
                <Icon name="history" />
              </button>
              <button
                className="icon-button collapse-button"
                type="button"
                aria-label="collapse assistant"
                onClick={collapse}
                title="collapse"
              >
                <span aria-hidden="true">−</span>
              </button>
            </div>
          </header>

          <div className="panel-content">
            {!online && (
              <div className="connection-notice" role="status">
                <div>
                  <strong>
                    {connection === 'connecting'
                      ? 'looking for your backend…'
                      : 'can’t reach your mac rn.'}
                  </strong>
                  <p>
                    {connection === 'connecting'
                      ? 'waiting on the local connection.'
                      : 'start the phntm backend and we’ll reconnect on our own.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setReconnect((value) => value + 1)}
                >
                  retry
                </button>
              </div>
            )}

            {history ? (
              <section className="history-view">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">this session</p>
                    <h1>behind the scenes.</h1>
                  </div>
                  <span className="count">{s.activity.length}</span>
                </div>
                {s.activity.length === 0 ? (
                  <div className="empty-state">
                    <Icon name="history" />
                    <h2>quiet in here rn.</h2>
                    <p>
                      tasks, actions and call stuff show up here.
                      <br />
                      nothing’s saved once you close the app.
                    </p>
                  </div>
                ) : (
                  <ol className="activity-list">
                    {[...s.activity].reverse().map((item, index) => (
                      <li key={`${item.time}-${index}`}>
                        <span className="activity-dot" />
                        <div>
                          <span className="activity-type">
                            {item.type === 'heard' ? 'heard you' : item.type}
                          </span>
                          <p>{item.text}</p>
                        </div>
                        <time dateTime={new Date(item.time).toISOString()}>
                          {new Date(item.time).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            ) : (
              <>
                {s.caption ? (
                  <section
                    className="caption-view"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    <p className="eyebrow">heard you</p>
                    <h1>“{s.caption}”</h1>
                    <span className="caption-context">
                      <Icon name="phone" />
                      from your facetime call
                    </span>
                  </section>
                ) : busy ||
                  s.phase === 'done' ||
                  s.phase === 'stopped' ||
                  s.phase === 'error' ? (
                  <section className="task-view">
                    <div className="task-status">
                      <span className="status-dot" />
                      {LABEL[s.phase]}
                      {s.steps > 0 && (
                        <span className="step-count">
                          {s.steps} {s.steps === 1 ? 'step' : 'steps'}
                        </span>
                      )}
                    </div>
                    <h1>
                      {s.task ||
                        (s.phase === 'error'
                          ? 'ok, let’s get you back on track.'
                          : s.phase === 'done'
                            ? 'one less thing on your plate.'
                            : s.phase === 'stopped'
                              ? 'back in your hands.'
                              : 'on it, bet.')}
                    </h1>
                    <p className="task-detail" aria-live="polite">
                      {s.step ||
                        (busy
                          ? 'peeping your screen…'
                          : s.phase === 'stopped'
                            ? 'task’s stopped. run it back whenever.'
                            : 'ready for the next one.')}
                    </p>
                    {s.phase === 'error' && (
                      <p className="recovery-hint">
                        check the backend logs, then run it back.
                      </p>
                    )}
                  </section>
                ) : s.inCall ? (
                  <section className="intro call-intro">
                    <div className="call-symbol">
                      <Icon name="phone" />
                    </div>
                    <p className="eyebrow">facetime</p>
                    <h1>
                      {s.phase === 'calling'
                        ? 'pull up on your iphone.'
                        : 'go off, i’m listening.'}
                    </h1>
                    <p>
                      {s.phase === 'calling'
                        ? 'pick up to talk to your mac.'
                        : 'say “phantom” then whatever you need.'}
                    </p>
                  </section>
                ) : (
                  <section className="intro">
                    <p className="eyebrow">lowkey here. highkey helpful.</p>
                    <h1>
                      your mac,
                      <br />
                      <span>at your command.</span>
                    </h1>
                    <p>say what you need. it handles the rest.</p>
                  </section>
                )}

                {editing && !s.inCall && (
                  <form
                    className="composer"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void send('run');
                    }}
                  >
                    <label htmlFor="task-input">
                      {busy ? 'changed your mind?' : 'what are we doing today?'}
                    </label>
                    <textarea
                      id="task-input"
                      name="task"
                      ref={input}
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="open notes and start a packing list…"
                      rows={2}
                      maxLength={8000}
                      autoComplete="off"
                      aria-describedby={
                        error ? 'request-error' : 'composer-hint'
                      }
                      aria-invalid={Boolean(error)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing
                        ) {
                          event.preventDefault();
                          void send('run');
                        }
                      }}
                    />
                    <div className="composer-footer">
                      <span id="composer-hint">
                        {busy ? (
                          'a new task replaces this one'
                        ) : (
                          <>
                            <kbd>↵</kbd> to run{' '}
                            <span className="hint-divider">/</span>{' '}
                            <kbd>⇧ ↵</kbd> new line
                          </>
                        )}
                      </span>
                      <button
                        className="run-button"
                        type="submit"
                        disabled={!online || Boolean(pending)}
                      >
                        {pending === 'run'
                          ? 'sending…'
                          : busy
                            ? 'run this instead'
                            : 'send it'}
                        <span className="button-icon">
                          <Icon name="arrow" />
                        </span>
                      </button>
                    </div>
                  </form>
                )}
                {error && (
                  <p className="request-error" id="request-error" role="alert">
                    {error}
                  </p>
                )}
                {busy && (
                  <button
                    className="stop-button"
                    type="button"
                    disabled={Boolean(pending)}
                    onClick={() => void send('stop')}
                  >
                    <span className="stop-square" />
                    {pending === 'stop' ? 'stopping…' : 'stop task'}
                    <kbd>esc</kbd>
                  </button>
                )}
                {editing && !s.inCall && s.phase === 'idle' && !text && (
                  <div className="suggestions">
                    <p className="eyebrow">or start small</p>
                    {suggestions.map((suggestion) => (
                      <button
                        type="button"
                        className="suggestion"
                        key={suggestion.title}
                        onClick={() => {
                          setText(suggestion.text);
                          input.current?.focus();
                        }}
                      >
                        <span className="suggestion-icon">
                          <Icon name={suggestion.icon} />
                        </span>
                        <span>
                          {suggestion.title}
                          <small>{suggestion.text}</small>
                        </span>
                        <span className="suggestion-arrow" aria-hidden="true">
                          ↗
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <footer className="panel-footer">
            <button
              className="remote-button"
              type="button"
              aria-expanded={help}
              aria-controls="remote-help"
              onClick={() => setHelp(!help)}
            >
              <Icon name="phone" />
              take it with you
              <span
                aria-hidden="true"
                className={help ? 'chevron is-open' : 'chevron'}
              >
                ⌄
              </span>
            </button>
            <span className="footer-note">your mac. still yours.</span>
          </footer>
          {help && (
            <section className="remote-help" id="remote-help">
              <h2>not at your desk?</h2>
              <ol>
                <li>
                  text yourself <code>ft me</code> on imessage.
                </li>
                <li>pick up your mac’s facetime call.</li>
                <li>say “phantom” and tell it what you need.</li>
              </ol>
              <p>
                needs imessage set up, macos permissions and blackhole audio
                routing. you might have to start screen sharing yourself.
              </p>
            </section>
          )}
        </main>
      )}
      <div className="island">
        <button
          className="island-toggle"
          type="button"
          ref={toggle}
          aria-label={editing ? 'collapse assistant' : 'open phntm assistant'}
          aria-expanded={expanded}
          onClick={() => (editing ? collapse() : setEditing(true))}
        >
          <span className="island-mark">
            <Icon name="ghost" />
          </span>
          <span className="island-status">
            <span className="status-dot" />
            <span aria-live="polite">{status}</span>
            {busy && s.steps > 0 && (
              <span className="island-steps">{s.steps}</span>
            )}
          </span>
          <span className="shortcut" aria-hidden="true">
            {expanded ? '⌄' : '⌘ ⇧ ␣'}
          </span>
        </button>
        {busy && (
          <button
            className="island-stop"
            type="button"
            aria-label="stop task"
            title="stop task (esc)"
            disabled={Boolean(pending)}
            onClick={() => void send('stop')}
          >
            <span className="stop-square" />
          </button>
        )}
      </div>
    </div>
  );
}
