import { MAX_EVENT_STREAM } from './constants.js';
import { state } from './state.js';
import { dom, log } from './ui.js';
import { renderEventCard } from './event-card.js';
import { parseFilterTerms } from './block-explorer.js';

export async function startEventStream() {
  if (state.eventStreamUnsub || !state.api) return;

  try {
    state.eventStreamUnsub = await state.api.query.system.events((events) => {
      const terms = parseFilterTerms(state.eventStreamFilter);

      for (const ev of events) {
        const text = `${ev.event.section}.${ev.event.method}`;
        if (terms.length > 0 && !terms.some(re => re.test(text))) continue;

        state.eventStreamEvents.unshift(ev);
        if (state.eventStreamEvents.length > MAX_EVENT_STREAM) {
          state.eventStreamEvents.pop();
        }

        const card = renderEventCard(ev);
        dom.eventStreamList.prepend(card);
      }

      while (dom.eventStreamList.children.length > MAX_EVENT_STREAM) {
        dom.eventStreamList.lastChild.remove();
      }
    });
    log('Event stream started');
  } catch (err) {
    log(`Event stream error: ${err.message}`);
  }
}

export function stopEventStream() {
  if (state.eventStreamUnsub) {
    state.eventStreamUnsub();
    state.eventStreamUnsub = null;
  }
  state.eventStreamEvents = [];
  if (dom.eventStreamList) dom.eventStreamList.innerHTML = '';
}

export function initEventStream() {
  dom.explorerViewToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-view]');
    if (!btn) return;
    const view = btn.dataset.view;

    for (const b of dom.explorerViewToggle.querySelectorAll('button')) {
      b.classList.toggle('active', b === btn);
    }

    const showBlocks = view === 'blocks';
    dom.explorerBlockList.classList.toggle('hidden', !showBlocks);
    dom.eventStreamPane.classList.toggle('hidden', showBlocks);

    if (!showBlocks && !state.eventStreamUnsub && state.api) {
      startEventStream();
    }
  });

  dom.eventStreamFilter.addEventListener('input', (e) => {
    state.eventStreamFilter = e.target.value;
    rerenderFilteredEvents();
  });
}

function rerenderFilteredEvents() {
  dom.eventStreamList.innerHTML = '';
  const terms = parseFilterTerms(state.eventStreamFilter);
  for (const ev of state.eventStreamEvents) {
    const text = `${ev.event.section}.${ev.event.method}`;
    if (terms.length > 0 && !terms.some(re => re.test(text))) continue;
    dom.eventStreamList.appendChild(renderEventCard(ev));
  }
}
