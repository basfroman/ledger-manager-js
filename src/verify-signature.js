import { dom } from './ui.js';

let _signatureVerify = null;
async function loadSignatureVerify() {
  if (!_signatureVerify) {
    const mod = await import('@polkadot/util-crypto');
    _signatureVerify = mod.signatureVerify;
  }
  return _signatureVerify;
}

const BYTES_PREFIX = '<Bytes>';
const BYTES_SUFFIX = '</Bytes>';
function wrapBytes(msg) { return BYTES_PREFIX + msg + BYTES_SUFFIX; }

export function initVerify() {
  dom.verifyBtn.addEventListener('click', async () => {
    const addr = dom.verifyAddress.value.trim();
    const msg = dom.verifyMessage.value;
    const sig = dom.verifySignature.value.trim();
    if (!addr || !msg || !sig) {
      dom.verifyResult.textContent = 'All fields required';
      dom.verifyResult.className = 'status-box status-err mt-8';
      return;
    }
    try {
      const verify = await loadSignatureVerify();
      let result = verify(msg, sig, addr);
      if (!result.isValid) {
        result = verify(wrapBytes(msg), sig, addr);
      }
      const ok = result.isValid;
      dom.verifyResult.textContent = ok ? 'Valid signature' : 'Invalid signature';
      dom.verifyResult.className = ok ? 'status-box status-ok mt-8' : 'status-box status-err mt-8';
    } catch (e) {
      dom.verifyResult.textContent = `Error: ${e.message}`;
      dom.verifyResult.className = 'status-box status-err mt-8';
    }
  });
}
