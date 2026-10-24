import assert from 'node:assert/strict';
import { test } from 'node:test';
import { describe, initial, isAgentEvent, reduce } from './state.ts';

const event = (state, type, text, now = 100) =>
  reduce(state, { kind: 'event', ev: { type, text }, now });

test('heard captions expire independently of running tasks', () => {
  const working = event(initial, 'action', 'open_app Notes');
  const heard = event(working, 'heard', 'Phantom, make a list', 1000);
  assert.equal(heard.phase, 'working');
  assert.equal(heard.caption, 'Phantom, make a list');
  const expired = reduce(heard, { kind: 'tick', now: 11000 });
  assert.equal(expired.caption, '');
  assert.equal(expired.phase, 'working');
});

test('results return to listening after six seconds on a call', () => {
  const listening = event(initial, 'status', 'listening on the FaceTime call');
  const done = event(listening, 'status', 'done', 1000);
  assert.equal(reduce(done, { kind: 'tick', now: 6999 }).phase, 'done');
  assert.equal(reduce(done, { kind: 'tick', now: 7000 }).phase, 'listening');
});

test('stopped results return to idle and retain session activity', () => {
  const stopped = event(initial, 'status', 'stopped', 1000);
  const resting = reduce(stopped, { kind: 'tick', now: 7000 });
  assert.equal(resting.phase, 'idle');
  assert.equal(resting.activity.length, 1);
});

test('ending a call does not hide a task that is still running', () => {
  const listening = event(initial, 'status', 'listening on the FaceTime call');
  const working = event(listening, 'action', 'click {}');
  const ended = event(working, 'status', 'call ended');
  assert.equal(ended.inCall, false);
  assert.equal(ended.phase, 'working');
});

test('watcher startup does not reset an active task', () => {
  const working = event(initial, 'action', 'click {}');
  assert.equal(
    event(working, 'status', 'watching iMessage: ready').phase,
    'working',
  );
});

test('failed calls clear call mode so the task composer stays available', () => {
  const calling = event(initial, 'status', 'calling preview phone');
  const failed = event(calling, 'status', 'call failed: unavailable');
  assert.equal(failed.inCall, false);
  assert.equal(failed.phase, 'error');
});

test('tasks preserve their title while steps and results arrive', () => {
  let state = event(initial, 'message', 'task from iMessage: Make a list');
  state = event(state, 'action', 'open_app Notes');
  state = event(state, 'message', 'Your note is ready');
  state = event(state, 'status', 'done');
  assert.equal(state.task, 'Make a list');
  assert.equal(state.step, 'Your note is ready');
  assert.equal(state.steps, 1);
});

test('typed task acknowledgement does not reset events that arrived first', () => {
  const working = event(initial, 'action', 'open_app Notes');
  const acknowledged = reduce(working, {
    kind: 'submitted',
    text: 'Make a list',
  });
  assert.equal(acknowledged.task, 'Make a list');
  assert.equal(acknowledged.phase, 'working');
  assert.equal(acknowledged.steps, 1);
});

test('malformed actions and unsupported events are handled safely', () => {
  assert.equal(describe('type {invalid'), 'reading the next move');
  assert.equal(describe('keypress {"keys":"cmd"}'), 'pressing ');
  assert.equal(describe('keypress {"keys":["cmd","a",1]}'), 'pressing ⌘A');
  assert.equal(isAgentEvent(null), false);
  assert.equal(isAgentEvent({ type: 'status', text: 2 }), false);
  assert.equal(isAgentEvent({ type: 'unknown', text: 'x' }), false);
  assert.equal(isAgentEvent({ type: 'heard', text: 'hello' }), true);
});

test('session activity is bounded and no empty captions overwrite speech', () => {
  let state = event(initial, 'heard', 'Hello');
  assert.equal(event(state, 'heard', ' ').caption, 'Hello');
  for (let index = 0; index < 50; index++)
    state = event(state, 'action', 'click {}', index);
  assert.equal(state.activity.length, 24);
  assert.equal(state.steps, 50);
});
