import { state } from './state.js';
import { MAX_TIMELINE_EVENTS } from './constants.js';

/**
 * Pure data module — manages timeline events in state, no DOM access.
 * @param {'info'|'warn'|'error'|'success'|'pin'} type
 * @param {string} title
 * @param {string} [detail]
 * @param {{ url: string, label: string }} [link]
 * @returns {object} the event object
 */
export function pushTimelineEvent(type, title, detail = '', link = null) {
  const event = { type, title, detail, ts: Date.now(), link };
  state.timelineEvents.push(event);
  if (state.timelineEvents.length > MAX_TIMELINE_EVENTS) {
    state.timelineEvents.shift();
  }
  return event;
}

export function clearTimeline() {
  state.timelineEvents.length = 0;
}

export function getTimelineSnapshot() {
  return state.timelineEvents.slice();
}
