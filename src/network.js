import { chainSupportsMetadataHash, getChainToken, isDevChain } from './chain-utils.js';
import { LS_LAST_ENDPOINT, NETWORK_PRESETS } from './constants.js';
import { state } from './state.js';
import { dom, positionDropdown, setStatus } from './ui.js';
import { pushTimelineEvent } from './timeline.js';
import { ApiPromise, WsProvider } from './deps.js';

export function getRpcUrl() {
  return state.networkPresetValue === 'custom'
    ? dom.customUrl.value.trim()
    : state.networkPresetValue;
}

/** Fills #networkPresetDropdown from NETWORK_PRESETS and syncs trigger to saved (or first) preset. */
export function renderNetworkPresetOptions() {
  const dd = dom.networkPresetDropdown;
  dd.innerHTML = '';
  const savedUrl = localStorage.getItem(LS_LAST_ENDPOINT);
  let selectedIdx = 0;
  if (savedUrl) {
    const idx = NETWORK_PRESETS.findIndex(p => p.url === savedUrl);
    if (idx >= 0) selectedIdx = idx;
  }
  for (let i = 0; i < NETWORK_PRESETS.length; i++) {
    const { label, url } = NETWORK_PRESETS[i];
    const div = document.createElement('div');
    div.className = 'custom-select-option';
    if (i === selectedIdx) div.classList.add('selected');
    div.dataset.value = url;
    if (url === 'custom') {
      div.innerHTML = `<span class="custom-select-label">${label}</span>`;
    } else {
      div.innerHTML = `<span class="custom-select-label">${label}</span><span class="custom-select-url">${url}</span>`;
    }
    dd.appendChild(div);
  }
  const preset = NETWORK_PRESETS[selectedIdx];
  state.networkPresetValue = preset.url;
  dom.networkPresetTrigger.querySelector('.custom-select-label').textContent = preset.label;
  const triggerUrl = dom.networkPresetTrigger.querySelector('.custom-select-url');
  triggerUrl.textContent = preset.url === 'custom' ? '' : preset.url;
  dom.customUrlWrap.classList.toggle('hidden', preset.url !== 'custom');
}

export function initNetwork({ onConnected, onDisconnected }) {
  renderNetworkPresetOptions();

  dom.networkPresetTrigger.addEventListener('click', () => {
    const wasHidden = dom.networkPresetDropdown.classList.contains('hidden');
    dom.networkPresetDropdown.classList.toggle('hidden');
    if (wasHidden) positionDropdown(dom.networkPresetTrigger, dom.networkPresetDropdown);
  });

  dom.networkPresetDropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.custom-select-option');
    if (!opt) return;
    const value = opt.dataset.value;
    state.networkPresetValue = value;

    dom.networkPresetDropdown.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');

    const labelEl = opt.querySelector('.custom-select-label');
    const urlEl = opt.querySelector('.custom-select-url');
    dom.networkPresetTrigger.querySelector('.custom-select-label').textContent = labelEl.textContent;
    const triggerUrl = dom.networkPresetTrigger.querySelector('.custom-select-url');
    triggerUrl.textContent = urlEl ? urlEl.textContent : '';

    dom.customUrlWrap.classList.toggle('hidden', value !== 'custom');
    dom.networkPresetDropdown.classList.add('hidden');
  });

  dom.connectBtn.addEventListener('click', async () => {
    const url = getRpcUrl();
    if (!url) { setStatus(dom.networkStatus, 'Enter a valid RPC URL', 'err'); return; }

    dom.connectBtn.disabled = true;
    setStatus(dom.networkStatus, `Connecting to ${url}...`, 'busy');

    try {
      if (state.api) { try { await state.api.disconnect(); } catch {} }
      const provider = new WsProvider(url);
      state.api = await ApiPromise.create({ provider, noInitWarn: true });

      state.api.on('disconnected', () => {
        if (!state.api) return;
        state.api = null;
        dom.connectBtn.disabled = false;
        dom.disconnectBtn.disabled = true;
        dom.disconnectBtn.classList.remove('btn-active');
        dom.networkPresetTrigger.disabled = false;
        dom.customUrl.disabled = false;
        dom.chainInfoBar.textContent = '';
        setStatus(dom.networkStatus, 'Connection lost — click Connect to reconnect', 'err');
        pushTimelineEvent('warn', 'Connection lost');
        onDisconnected();
      });

      const [runtime, header] = await Promise.all([
        state.api.rpc.state.getRuntimeVersion(),
        state.api.rpc.chain.getHeader(),
      ]);
      const blockNum = header.number.toNumber().toLocaleString();
      const hasMetaHash = chainSupportsMetadataHash(state.api);
      const devChain = isDevChain(state.api);

      let statusLine = `Connected: Subtensor spec. ${runtime.specVersion} | Block #${blockNum}`;
      if (devChain) statusLine += ' | DEV CHAIN (metadata hash will be broken)';
      if (!hasMetaHash) {
        statusLine += ' | WARNING: Ledger needs CheckMetadataHash; Wallet (extension) may still work';
      }

      dom.networkStatus.textContent = '';
      const token = getChainToken(state.api);
      dom.chainInfoBar.textContent = `Subtensor spec. ${runtime.specVersion} | Block #${blockNum} | ${token}`;
      dom.connectBtn.disabled = true;
      dom.disconnectBtn.disabled = false;
      dom.disconnectBtn.classList.add('btn-active');
      dom.networkPresetTrigger.disabled = true;
      dom.customUrl.disabled = true;
      try { localStorage.setItem(LS_LAST_ENDPOINT, url); } catch {}
      pushTimelineEvent('info', `Connected to ${url}`);
      onConnected();
    } catch (err) {
      setStatus(dom.networkStatus, `Connection failed: ${err.message}`, 'err');
      state.api = null;
      dom.connectBtn.disabled = false;
    }
  });

  dom.disconnectBtn.addEventListener('click', async () => {
    if (state.api) { try { await state.api.disconnect(); } catch {} }
    state.api = null;
    dom.connectBtn.disabled = false;
    dom.disconnectBtn.disabled = true;
    dom.disconnectBtn.classList.remove('btn-active');
    dom.networkPresetTrigger.disabled = false;
    dom.customUrl.disabled = false;
    dom.networkStatus.textContent = '';
    dom.chainInfoBar.textContent = '';
    pushTimelineEvent('info', 'Disconnected');
    onDisconnected();
  });
}
