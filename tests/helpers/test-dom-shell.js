/** Minimal HTML so initDomRefs() finds every element (happy-dom / browser tests). */
export function mountAppShell() {
  document.body.innerHTML = `
<div class="main-workspace" id="mainWorkspace">
<div class="left-column" id="leftColumn">
<section id="networkSection">
<div class="custom-select" id="networkPresetWrap">
  <button class="custom-select-trigger" id="networkPresetTrigger" type="button">
    <span class="custom-select-label"></span><span class="custom-select-url"></span>
  </button>
  <div class="custom-select-dropdown hidden" id="networkPresetDropdown"></div>
</div>
<div id="customUrlWrap" class="hidden"><input id="customUrl" value="ws://127.0.0.1:9944" /></div>
<button id="connectBtn"></button><button id="disconnectBtn"></button>
<div id="networkStatus"></div>
</section>
<section id="sourceSection">
<div id="accountSourceToggle"><button type="button" data-mode="ledger"></button><button type="button" data-mode="wallet"></button></div>
<div id="ledgerOnlyWrap">
<button id="addDeviceBtn"></button><button id="loadAccountsBtn"></button>
<input id="singleAccountIndex" /><button id="loadSingleAccountBtn"></button>
</div>
<div id="walletOnlyWrap" class="hidden">
<div class="custom-select wallet-extension-select-wrap" id="walletExtensionWrap">
  <button type="button" class="custom-select-trigger" id="walletExtensionTrigger" aria-expanded="false">
    <span class="custom-select-label">— Choose extension —</span>
  </button>
  <div class="custom-select-dropdown hidden" id="walletExtensionDropdown"></div>
</div>
<button type="button" id="refreshExtensionsBtn"></button>
<p id="walletExtensionHint"></p>
<button id="loadExtensionAccountsBtn"></button>
</div>
<div id="ledgerStatus"></div>
<table><tbody id="deviceListBody"></tbody></table>
</section>
<section id="accountsSection">
<h2 id="accountsTitle">Accounts</h2>
<button id="refreshBalancesBtn"></button>
<div class="accounts-scroll"><table><tbody id="accountsBody"></tbody></table></div>
</section>
</div>
<section id="txSection">
<div id="builderPane">
<div class="custom-select" id="palletSelectWrap">
  <button class="custom-select-trigger" id="palletSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="palletSelectDropdown"></div>
</div>
<div class="custom-select" id="methodSelectWrap">
  <button class="custom-select-trigger" id="methodSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="methodSelectDropdown"></div>
</div>
<div id="extrinsicDocs"></div><div id="extrinsicArgs"></div><button id="extrinsicSendBtn"></button>
</div>
</section>
</div>
<div id="txStatus"></div>
<div id="txResultWrap"><div id="txResult"></div></div>
<pre id="logPanel"></pre>
<button id="logCopyBtn"></button><button id="resultCopyBtn"></button>
<a id="explorerLink"><span id="explorerLinkLabel"></span></a>
`;
}
