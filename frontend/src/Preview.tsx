import { useState } from 'react';
import { App } from './App';
import { Icon } from './Icon';
import type { AgentEvent, Phase } from './state';
import type { Connection, Transport } from './transport';
import './preview.css';

type PreviewState = Phase | 'offline' | 'caption' | 'request-error';

function createPreviewTransport() {
  let event: (value: AgentEvent) => void = () => {};
  let connection: (value: Connection) => void = () => {};
  let timers: ReturnType<typeof setTimeout>[] = [];
  let failRequests = false;
  const clear = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };
  const emit = (type: AgentEvent['type'], text: string) =>
    event({ type, text });
  const transport: Transport = {
    subscribe(onEvent, onConnection) {
      event = onEvent;
      connection = onConnection;
      connection('connected');
      return clear;
    },
    async run(text) {
      if (failRequests) throw new Error('Simulated request failure');
      clear();
      emit('message', `task: ${text}`);
      const sequence: AgentEvent[] = [
        { type: 'action', text: 'screenshot' },
        { type: 'action', text: 'open_app Notes' },
        {
          type: 'message',
          text: 'preview done. no apps opened and nothing changed on your mac.',
        },
        { type: 'status', text: 'done' },
      ];
      timers = sequence.map((item, index) =>
        setTimeout(() => event(item), (index + 1) * 1200),
      );
    },
    async stop() {
      clear();
      emit('status', 'stopped');
    },
  };
  return {
    transport,
    scenario(phase: PreviewState) {
      clear();
      failRequests = phase === 'request-error';
      connection(phase === 'offline' ? 'offline' : 'connected');
      if (phase === 'offline' || phase === 'idle') return;
      if (phase === 'calling') emit('status', 'calling preview iphone');
      if (phase === 'listening' || phase === 'caption')
        emit('status', 'listening on the FaceTime call');
      if (phase === 'caption')
        emit(
          'heard',
          'phantom, open notes and start a packing list for the weekend.',
        );
      if (
        phase === 'thinking' ||
        phase === 'working' ||
        phase === 'done' ||
        phase === 'stopped'
      ) {
        emit('message', 'task: open notes and start a packing list.');
        if (phase !== 'thinking') emit('action', 'open_app notes');
        if (phase === 'done')
          emit(
            'message',
            'your packing list is ready in notes. just a preview tho.',
          );
        if (phase === 'done' || phase === 'stopped') emit('status', phase);
      }
      if (phase === 'error')
        emit(
          'status',
          'error: screen recording permission is missing. turn it on for your terminal in system settings, then restart the backend.',
        );
    },
  };
}

const preview = createPreviewTransport();

export function Preview() {
  const [scenario, setScenario] = useState<PreviewState>('idle');
  const [version, setVersion] = useState(0);
  return (
    <div className="preview">
      <header className="preview-header">
        <div className="preview-wordmark">
          <Icon name="ghost" />
          phntm<span>interface preview</span>
        </div>
        <span className="preview-safe">
          <span />
          no mac control
        </span>
      </header>
      <section
        className="preview-stage"
        aria-label="interactive assistant preview"
      >
        <div className="preview-caption">
          <span>small footprint.</span>
          <span>big help energy.</span>
        </div>
        <App
          key={version}
          transport={{
            ...preview.transport,
            subscribe(onEvent, onConnection) {
              const cleanup = preview.transport.subscribe(
                onEvent,
                onConnection,
              );
              preview.scenario(scenario);
              return cleanup;
            },
          }}
          preview
        />
      </section>
      <footer className="preview-toolbar">
        <label htmlFor="preview-state">explore a state</label>
        <select
          id="preview-state"
          value={scenario}
          onChange={(event) => {
            setScenario(event.target.value as typeof scenario);
            setVersion((value) => value + 1);
          }}
        >
          <option value="idle">ready</option>
          <option value="thinking">thinking</option>
          <option value="working">working</option>
          <option value="calling">calling</option>
          <option value="listening">listening</option>
          <option value="caption">live caption</option>
          <option value="done">done</option>
          <option value="stopped">stopped</option>
          <option value="error">error</option>
          <option value="offline">offline</option>
          <option value="request-error">request failure</option>
        </select>
        <span className="preview-toolbar-note">
          try a task. it’s all simulated, nothing touches your mac.
        </span>
      </footer>
    </div>
  );
}
