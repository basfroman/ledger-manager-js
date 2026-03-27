/** Minimal HTML so initDomRefs() finds every element (happy-dom / browser tests). */
export function mountAppShell() {
  document.body.innerHTML = `
<div id="topBar" class="top-bar">
  <div class="top-bar-section top-bar-network">
    <div class="custom-select custom-select-compact" id="networkPresetWrap">
      <button class="custom-select-trigger" id="networkPresetTrigger" type="button">
        <span class="custom-select-label"></span><span class="custom-select-url"></span>
      </button>
      <div class="custom-select-dropdown hidden" id="networkPresetDropdown"></div>
    </div>
    <div id="customUrlWrap" class="hidden"><input id="customUrl" value="ws://127.0.0.1:9944" /></div>
    <div class="top-bar-buttons">
      <button id="connectBtn"></button><button id="disconnectBtn"></button>
    </div>
    <div id="networkStatus"></div>
  </div>
  <div class="top-bar-section">
    <div class="seg-control seg-control-sm" id="accountSourceToggle">
      <button type="button" class="active" data-mode="ledger">Ledger</button>
      <button type="button" data-mode="wallet">Wallet</button>
    </div>
  </div>
  <div class="top-bar-section top-bar-chain">
    <div id="signingAccountBar" class="top-bar-account hidden">
      <span class="account-dot"></span><code id="signingAddr"></code>
    </div>
    <div id="chainInfoBar" class="chain-info-bar"></div>
  </div>
</div>
<div id="appBody" class="app-body">
  <nav id="navRail" class="nav-rail" role="tablist">
    <button type="button" class="nav-rail-btn active" role="tab" data-route="compose" aria-selected="true"><span>Compose</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="dataHub" aria-selected="false"><span>Data</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="accounts" aria-selected="false"><span>Accounts</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="diagnostics" aria-selected="false"><span>Debug</span></button>
  </nav>
  <main id="mainCanvas" class="main-canvas">
    <div id="routeCompose" role="tabpanel">
      <div id="builderPane">
        <div class="custom-select" id="palletSelectWrap">
          <button class="custom-select-trigger" id="palletSelectTrigger" type="button"><span class="custom-select-label"></span></button>
          <div class="custom-select-dropdown hidden" id="palletSelectDropdown"></div>
        </div>
        <div class="custom-select" id="methodSelectWrap">
          <button class="custom-select-trigger" id="methodSelectTrigger" type="button"><span class="custom-select-label"></span></button>
          <div class="custom-select-dropdown hidden" id="methodSelectDropdown"></div>
        </div>
        <div id="extrinsicArgs"></div>
        <button id="feeEstimateBtn"></button><button id="extrinsicSendBtn"></button>
        <div id="feeEstimate"></div>
        <div id="preflightChecklist"></div>
      </div>
      <div id="txStatus"></div>
      <div id="txResultWrap"><div class="log-wrap"><button class="log-copy-btn" id="resultCopyBtn"></button><div id="txResult"></div></div></div>
      <a id="explorerLink"><span id="explorerLinkLabel"></span></a>
    </div>
    <div id="routeDataHub" class="hidden" role="tabpanel">
      <div class="section-header">
        <h2 id="rightPanelTitle">Queries</h2>
        <div class="seg-control" id="rightPanelToggle">
          <button type="button" class="active" data-pane="queryPane" data-title="Queries">Queries</button>
          <button type="button" data-pane="constantsPane" data-title="Constants">Constants</button>
        </div>
      </div>
      <div id="queryPane">
        <div class="custom-select" id="qPalletSelectWrap">
          <button class="custom-select-trigger" id="qPalletSelectTrigger" type="button"><span class="custom-select-label"></span></button>
          <div class="custom-select-dropdown hidden" id="qPalletSelectDropdown"></div>
        </div>
        <div class="custom-select" id="qStorageSelectWrap">
          <button class="custom-select-trigger" id="qStorageSelectTrigger" type="button"><span class="custom-select-label"></span></button>
          <div class="custom-select-dropdown hidden" id="qStorageSelectDropdown"></div>
        </div>
        <div id="queryKeys"></div><button id="queryExecuteBtn"></button>
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
        <div id="constantResultWrap"><div class="log-wrap"><button class="log-copy-btn" id="constantResultCopyBtn"></button><pre id="constantResult"></pre></div></div>
      </div>
    </div>
    <div id="routeAccounts" class="hidden" role="tabpanel">
      <section id="sourceSection">
        <div id="ledgerOnlyWrap">
          <button id="addDeviceBtn"></button><button id="loadAccountsBtn"></button>
          <input id="singleAccountIndex" /><button id="loadSingleAccountBtn"></button>
          <table><tbody id="deviceListBody"></tbody></table>
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
      </section>
      <section id="accountsSection" class="panel-locked">
        <h2 id="accountsTitle">Accounts</h2>
        <button id="refreshBalancesBtn"></button>
        <div class="accounts-scroll"><table><tbody id="accountsBody"></tbody></table></div>
      </section>
    </div>
    <div id="routeDiagnostics" class="hidden" role="tabpanel">
      <div id="diagnosticsCard"></div>
      <section id="logSection">
        <div class="log-wrap"><button class="log-copy-btn" id="logCopyBtn"></button><pre class="log-panel" id="logPanel"></pre></div>
      </section>
    </div>
  </main>
  <aside id="insightRail" class="insight-rail">
    <div class="insight-resize-handle" id="insightResizeHandle"></div>
    <div id="insightContent"></div>
    <div class="doc-block hidden" id="extrinsicDocs" data-insight-route="compose"></div>
    <div class="doc-block hidden" id="queryDocs" data-insight-route="dataHub"></div>
    <div class="doc-block hidden" id="constantDocs" data-insight-route="dataHub"></div>
  </aside>
</div>
<div id="timelineDock" class="timeline-dock">
  <div class="section-header">
    <button type="button" id="footerCollapseBtn">Collapse</button>
  </div>
  <div id="timelineList" class="timeline-list" role="log" aria-live="polite"></div>
</div>
<div id="commandPalette" class="command-palette-overlay hidden">
  <div class="command-palette">
    <input id="paletteSearch" /><ul id="paletteResults"></ul>
  </div>
</div>
`;
}
