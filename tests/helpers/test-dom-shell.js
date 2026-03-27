/** Minimal HTML so initDomRefs() finds every element (happy-dom / browser tests). */
export function mountAppShell() {
  document.body.innerHTML = `
<header id="appHeader" class="hidden"><div id="chainInfoBar"></div></header>
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
<div class="section-header">
  <h2 id="rightPanelTitle">Extrinsic Builder</h2>
  <div class="seg-control" id="rightPanelToggle">
    <button type="button" class="active" data-pane="builderPane" data-title="Extrinsic Builder">Extrinsic</button>
    <button type="button" data-pane="queryPane" data-title="Queries">Queries</button>
    <button type="button" data-pane="constantsPane" data-title="Constants">Constants</button>
  </div>
</div>
<div id="builderPane">
<div id="signingAccountBar" class="hidden"><code id="signingAddr"></code></div>
<div class="custom-select" id="palletSelectWrap">
  <button class="custom-select-trigger" id="palletSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="palletSelectDropdown"></div>
</div>
<div class="custom-select" id="methodSelectWrap">
  <button class="custom-select-trigger" id="methodSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="methodSelectDropdown"></div>
</div>
<div id="extrinsicDocs"></div><div id="extrinsicArgs"></div><button id="feeEstimateBtn"></button><button id="extrinsicSendBtn"></button><div id="feeEstimate"></div>
</div>
<div id="queryPane" class="hidden">
<div class="custom-select" id="qPalletSelectWrap">
  <button class="custom-select-trigger" id="qPalletSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="qPalletSelectDropdown"></div>
</div>
<div class="custom-select" id="qStorageSelectWrap">
  <button class="custom-select-trigger" id="qStorageSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="qStorageSelectDropdown"></div>
</div>
<div id="queryKeys"></div><button id="queryExecuteBtn"></button>
<div id="queryDocs"></div>
<div id="queryResultWrap"><div class="log-wrap"><button class="log-copy-btn" id="queryResultCopyBtn"></button><pre id="queryResult"></pre></div></div>
</div>
<div id="constantsPane" class="hidden">
<div class="custom-select" id="cPalletSelectWrap">
  <button class="custom-select-trigger" id="cPalletSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="cPalletSelectDropdown"></div>
</div>
<div class="custom-select" id="cConstantSelectWrap">
  <button class="custom-select-trigger" id="cConstantSelectTrigger" type="button"><span class="custom-select-label"></span></button>
  <div class="custom-select-dropdown hidden" id="cConstantSelectDropdown"></div>
</div>
<div id="constantDocs"></div>
<div id="constantResultWrap"><div class="log-wrap"><button class="log-copy-btn" id="constantResultCopyBtn"></button><pre id="constantResult"></pre></div></div>
</div>
</section>
</div>
<div class="bottom-row" id="bottomRow">
<section>
<div id="txStatus"></div>
<div id="txResultWrap"><div id="txResult"></div></div>
</section>
<section id="logSection">
<button type="button" id="footerCollapseBtn">Collapse</button>
<pre id="logPanel"></pre>
</section>
</div>
<button id="logCopyBtn"></button><button id="resultCopyBtn"></button>
<a id="explorerLink"><span id="explorerLinkLabel"></span></a>
<div id="commandPalette" class="hidden">
<input id="paletteSearch" />
<ul id="paletteResults"></ul>
</div>
`;
}
