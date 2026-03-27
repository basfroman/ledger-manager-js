// @vitest-environment happy-dom

import { describe, it, expect, beforeEach } from 'vitest';
import { pushTimelineEvent, clearTimeline, getTimelineSnapshot } from '../src/timeline.js';
import { state } from '../src/state.js';
import { MAX_TIMELINE_EVENTS } from '../src/constants.js';

beforeEach(() => {
  state.timelineEvents = [];
});

describe('pushTimelineEvent', () => {
  it('adds an event with correct structure', () => {
    const evt = pushTimelineEvent('info', 'Connected', 'to node');
    expect(evt.type).toBe('info');
    expect(evt.title).toBe('Connected');
    expect(evt.detail).toBe('to node');
    expect(typeof evt.ts).toBe('number');
    expect(state.timelineEvents).toHaveLength(1);
  });

  it('defaults detail to empty string', () => {
    const evt = pushTimelineEvent('warn', 'Test');
    expect(evt.detail).toBe('');
  });

  it('respects all event types', () => {
    for (const type of ['info', 'warn', 'error', 'success', 'pin']) {
      pushTimelineEvent(type, `${type} event`);
    }
    expect(state.timelineEvents).toHaveLength(5);
    expect(state.timelineEvents.map(e => e.type)).toEqual(['info', 'warn', 'error', 'success', 'pin']);
  });
});

describe('FIFO eviction', () => {
  it(`caps at ${MAX_TIMELINE_EVENTS} events`, () => {
    for (let i = 0; i < MAX_TIMELINE_EVENTS + 10; i++) {
      pushTimelineEvent('info', `event-${i}`);
    }
    expect(state.timelineEvents).toHaveLength(MAX_TIMELINE_EVENTS);
    expect(state.timelineEvents[0].title).toBe('event-10');
    expect(state.timelineEvents[MAX_TIMELINE_EVENTS - 1].title).toBe(`event-${MAX_TIMELINE_EVENTS + 9}`);
  });
});

describe('clearTimeline', () => {
  it('empties the timeline', () => {
    pushTimelineEvent('info', 'A');
    pushTimelineEvent('info', 'B');
    clearTimeline();
    expect(state.timelineEvents).toHaveLength(0);
  });
});

describe('getTimelineSnapshot', () => {
  it('returns a shallow copy', () => {
    pushTimelineEvent('info', 'One');
    pushTimelineEvent('error', 'Two');
    const snap = getTimelineSnapshot();
    expect(snap).toHaveLength(2);
    expect(snap).not.toBe(state.timelineEvents);
    expect(snap[0]).toBe(state.timelineEvents[0]);
  });
});
