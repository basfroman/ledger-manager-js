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
  <div class="top-bar-section top-bar-chain">
    <div id="signingAccountBar" class="top-bar-account hidden">
      <span>Account:</span>
      <div class="custom-select custom-select-compact" id="accountSelectWrap">
        <button class="custom-select-trigger" id="accountSelectTrigger" type="button" disabled>
          <span class="custom-select-label">No account</span>
        </button>
        <div class="custom-select-dropdown hidden" id="accountSelectDropdown"></div>
      </div>
    </div>
    <div id="chainInfoBar" class="chain-info-bar"></div>
  </div>
</div>
<div id="appBody" class="app-body">
  <nav id="navRail" class="nav-rail" role="tablist">
    <button type="button" class="nav-rail-btn active" role="tab" data-route="explorer" aria-selected="true"><span>Explorer</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="compose" aria-selected="false"><span>Exec</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="dataHub" aria-selected="false"><span>Data</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="accounts" aria-selected="false"><span>Accounts</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="diagnostics" aria-selected="false"><span>Debug</span></button>
    <button type="button" class="nav-rail-btn" role="tab" data-route="settings" aria-selected="false"><span>Settings</span></button>
  </nav>
  <main id="mainCanvas" class="main-canvas">
    <div id="routeCompose" class="hidden" role="tabpanel">
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
        <button id="feeEstimateBtn"></button><button id="dryRunBtn"></button><button id="addToBatchBtn"></button><button id="extrinsicSendBtn"></button>
        <div id="feeEstimate"></div>
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
          <button type="button" data-pane="metadataPane" data-title="Metadata">Metadata</button>
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
        <div id="queryKeys"></div>
        <div class="row query-execute-row">
          <input id="queryAtBlock" />
          <label class="query-compare-label"><input type="checkbox" id="queryCompare" /> Compare</label>
          <button id="queryExecuteBtn"></button>
        </div>
        <div id="queryResultWrap"><div class="log-wrap"><button class="log-copy-btn" id="queryResultCopyBtn"></button><pre id="queryResult"></pre></div></div>
        <div id="watchPanel"></div>
        <div id="mapBrowserWrap" class="hidden"></div>
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
      <div id="metadataPane" class="hidden"></div>
    </div>
    <div id="routeAccounts" class="hidden" role="tabpanel">
      <section id="sourceSection">
        <div class="seg-control seg-control-sm mb-12" id="accountSourceToggle">
          <button type="button" class="active" data-mode="wallet">Wallet</button>
          <button type="button" data-mode="ledger">Ledger</button>
        </div>
        <div id="walletOnlyWrap">
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
        <div id="ledgerOnlyWrap" class="hidden">
          <button id="addDeviceBtn"></button><button id="loadAccountsBtn"></button>
          <input id="singleAccountIndex" /><button id="loadSingleAccountBtn"></button>
          <table><tbody id="deviceListBody"></tbody></table>
        </div>
        <div id="ledgerStatus"></div>
      </section>
      <section id="accountsSection" class="panel-locked">
        <h2 id="accountsTitle">Accounts</h2>
        <button id="refreshBalancesBtn"></button>
        <div class="accounts-scroll"><table><thead><tr><th>#</th><th>Address</th><th id="pathColHeader">Source / Path</th><th>Balance (TAO)</th><th></th></tr></thead><tbody id="accountsBody"></tbody></table></div>
      </section>
    </div>
    <div id="routeExplorer" role="tabpanel">
      <div class="explorer-toolbar">
        <input id="explorerSearchInput" />
        <button id="explorerSearchBtn"></button>
        <button id="explorerLiveBtn"></button>
      </div>
      <div class="explorer-split">
        <div class="explorer-list-pane">
          <div id="explorerBlockList"></div>
        </div>
        <div id="explorerDetailPane"></div>
      </div>
    </div>
    <div id="routeDiagnostics" class="hidden" role="tabpanel">
      <div id="chainHealth"></div>
      <div id="diagnosticsCard"></div>
      <div id="nonceInfo"></div>
      <section id="logSection">
        <div class="log-wrap"><button class="log-copy-btn" id="logCopyBtn"></button><pre class="log-panel" id="logPanel"></pre></div>
      </section>
    </div>
    <div id="routeSettings" class="hidden" role="tabpanel">
      <input type="color" id="accentColorInput" value="#e8943c" />
      <span id="accentHexLabel">#e8943c</span>
      <button id="accentResetBtn"></button>
      <div class="accent-presets-row" id="accentPresets">
        <button type="button" class="accent-dot active" data-preset="Orange"></button>
        <button type="button" class="accent-dot" data-preset="Purple"></button>
      </div>
    </div>
  </main>
  <aside id="insightRail" class="insight-rail">
    <div class="insight-resize-handle" id="insightResizeHandle"></div>
    <div id="insightContent"></div>
    <div class="doc-block hidden" id="explorerDocs" data-insight-route="explorer"></div>
    <div class="doc-block hidden" id="extrinsicDocs" data-insight-route="compose"></div>
    <div class="doc-block hidden" id="queryDocs" data-insight-route="dataHub"></div>
    <div class="doc-block hidden" id="constantDocs" data-insight-route="dataHub"></div>
    <div class="doc-block hidden" id="metadataDocs" data-insight-route="dataHub"></div>
    <div id="accountXRay" class="hidden" data-insight-route="accounts"></div>
    <div id="proxyManager" class="hidden" data-insight-route="accounts"></div>
    <details id="addressBookSection" data-insight-route="accounts" style="display:none"><summary>Address Book</summary><div id="addressBookContent"></div></details>
    <div id="explorerChainInfo" data-insight-route="explorer"></div>
    <div class="insight-preflight" data-insight-route="compose" style="display:none"><div id="preflightChecklist"></div></div>
    <div id="signMessageSection" class="hidden" data-insight-route="compose">
      <textarea id="signMessageInput"></textarea><button id="signMessageBtn" disabled></button><div id="signMessageResult"></div>
    </div>
    <details class="decode-section" data-insight-route="compose">
      <summary>Verify Signature</summary>
      <input id="verifyAddress" /><textarea id="verifyMessage"></textarea><input id="verifySignature" />
      <button id="verifyBtn"></button><div id="verifyResult"></div>
    </details>
    <details class="decode-section" data-insight-route="compose">
      <summary>Hex Decoder</summary>
      <textarea id="decodeInput"></textarea>
      <div class="custom-select" id="decodeTypeHintWrap">
        <button class="custom-select-trigger" id="decodeTypeHintTrigger" type="button"><span class="custom-select-label">Auto-detect</span></button>
        <div class="custom-select-dropdown hidden" id="decodeTypeHintDropdown">
          <div class="custom-select-option selected" data-value="auto"><span class="custom-select-label">Auto-detect</span></div>
        </div>
      </div>
      <button id="decodeBtn"></button>
      <div id="decodeResult"></div>
    </details>
  </aside>
</div>
<div id="timelineDock" class="timeline-dock collapsed">
  <div class="section-header">
    <button type="button" id="footerCollapseBtn">Expand</button>
  </div>
  <div id="batchList" class="batch-list hidden"></div>
  <div id="timelineList" class="timeline-list" role="log" aria-live="polite"></div>
</div>
<div id="commandPalette" class="command-palette-overlay hidden">
  <div class="command-palette">
    <input id="paletteSearch" /><ul id="paletteResults"></ul>
  </div>
</div>
`;
}
