import { web3FromAddress } from '@polkadot/extension-dapp';
import { u8aToHex } from './deps.js';
import { copyToClipboard } from './chain-utils.js';
import { ACCOUNT_SOURCE } from './constants.js';
import { state } from './state.js';
import { dom, addResultAction } from './ui.js';

export function updateSignVisibility() {
  const show = state.accountSource === ACCOUNT_SOURCE.WALLET && Boolean(state.selectedAccount);
  dom.signMessageSection.classList.toggle('hidden', !show);
  dom.signMessageBtn.disabled = !show;
}

export function initSignMessage() {
  dom.signMessageBtn.addEventListener('click', async () => {
    const msg = dom.signMessageInput.value;
    if (!msg || !state.selectedAccount) return;
    dom.signMessageBtn.disabled = true;
    try {
      const injector = await web3FromAddress(state.selectedAccount.address);
      const result = await injector.signer.signRaw({
        address: state.selectedAccount.address,
        data: u8aToHex(new TextEncoder().encode(msg)),
        type: 'bytes',
      });
      dom.signMessageResult.textContent = result.signature;
      dom.signMessageResult.className = 'result-block mt-8';
      addResultAction(dom.signMessageResult, 'Copy', 'copy-sig-btn', () => {
        copyToClipboard(result.signature);
      });
    } catch (e) {
      dom.signMessageResult.textContent = `Error: ${e.message}`;
      dom.signMessageResult.className = 'status-box status-err mt-8';
    } finally {
      dom.signMessageBtn.disabled = false;
    }
  });
}
