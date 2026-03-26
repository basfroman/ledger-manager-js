/** Minimal HTML so initDomRefs() finds every element (happy-dom / browser tests). */
export function mountAppShell() {
  document.body.innerHTML = `
<div class="top-row" id="topRow"><section></section><section></section></div>
<div class="custom-select" id="networkPresetWrap">
  <button class="custom-select-trigger" id="networkPresetTrigger" type="button">
    <span class="custom-select-label"></span><span class="custom-select-url"></span>
  </button>
  <div class="custom-select-dropdown hidden" id="networkPresetDropdown"></div>
</div>
<div id="customUrlWrap" class="hidden"><input id="customUrl" value="ws://127.0.0.1:9944" /></div>
<button id="connectBtn"></button><button id="disconnectBtn"></button>
<div id="networkStatus"></div>
<button id="addDeviceBtn"></button><button id="loadAccountsBtn"></button>
<input id="singleAccountIndex" /><button id="loadSingleAccountBtn"></button>
<div id="ledgerStatus"></div>
<table><tbody id="deviceListBody"></tbody></table>
<table><tbody id="accountsBody"></tbody></table>
<h2 id="accountsTitle">Accounts</h2>
<button id="refreshBalancesBtn"></button>
<input id="fromAddress" /><input id="toAddress" /><input id="amount" />
<button id="sendBtn"></button>
<div id="txStatus"></div>
<div id="txResultWrap"><div id="txResult"></div></div>
<pre id="logPanel"></pre>
<div class="custom-select" id="palletSelectWrap">
  <button class="custom-select-trigger" id="palletSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="palletSelectDropdown"></div>
</div>
<div class="custom-select" id="methodSelectWrap">
  <button class="custom-select-trigger" id="methodSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="methodSelectDropdown"></div>
</div>
<div id="extrinsicDocs"></div><div id="extrinsicArgs"></div><button id="extrinsicSendBtn"></button>
<div id="transferPane"></div><div id="builderPane"></div>
<div id="txModeToggle"><button data-mode="transfer"></button><button data-mode="builder"></button></div>
<button id="logCopyBtn"></button><button id="resultCopyBtn"></button>
<a id="explorerLink"><span id="explorerLinkLabel"></span></a>
`;
}
