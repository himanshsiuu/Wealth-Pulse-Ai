/**
 * WealthPulse AI — Main App & Real-Time Coordinator
 * Handles Multi-Brokerage Ingestion, Real-Time Market Streaming, AMFI Live NAV Sync,
 * and Streaming AI Copilot.
 */

let activePortfolio = null;
let currentBrokerageFilter = "ALL";
let serverSamples = {};

// Real-Time Streaming State
const WealthLive = {
  eventSource: null,
  isStreaming: true,
  lastIndices: {},

  init() {
    this.connectLiveStream();
    this.initControls();
  },

  connectLiveStream() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    try {
      this.eventSource = new EventSource("/api/live-stream");

      this.eventSource.onopen = () => {
        this.updateBeaconState(true);
      };

      this.eventSource.onmessage = (event) => {
        if (!this.isStreaming) return;
        try {
          const data = JSON.parse(event.data);
          this.handleLiveTick(data);
        } catch (e) {
          console.warn("Live stream tick parse error:", e);
        }
      };

      this.eventSource.onerror = () => {
        this.updateBeaconState(false);
      };
    } catch (e) {
      console.warn("SSE connection error:", e);
      this.updateBeaconState(false);
    }
  },

  initControls() {
    const toggleBtn = document.getElementById("btnLiveStreamToggle");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        this.isStreaming = !this.isStreaming;
        this.updateBeaconState(this.isStreaming);
        showNotification(
          this.isStreaming ? "🟢 Real-Time Market Stream Resumed" : "⏸️ Market Stream Paused",
          this.isStreaming ? "success" : "info"
        );
      });
    }

    const syncBtn = document.getElementById("btnSyncLiveNavs");
    if (syncBtn) {
      syncBtn.addEventListener("click", () => syncLiveAMFINAVs());
    }

    const tableSyncBtn = document.getElementById("btnSyncTableNavs");
    if (tableSyncBtn) {
      tableSyncBtn.addEventListener("click", () => syncLiveAMFINAVs());
    }
  },

  updateBeaconState(active) {
    const beacon = document.getElementById("btnLiveStreamToggle");
    const text = document.getElementById("liveStreamText");
    if (!beacon || !text) return;

    if (active && this.isStreaming) {
      beacon.className = "live-pulse-beacon";
      text.innerText = "LIVE STREAM";
    } else {
      beacon.className = "live-pulse-beacon paused";
      text.innerText = this.isStreaming ? "CONNECTING..." : "STREAM PAUSED";
    }
  },

  handleLiveTick(tickData) {
    if (!tickData) return;

    // 1. Update Market Ticker Tape
    if (tickData.indices) {
      for (const [key, item] of Object.entries(tickData.indices)) {
        const valEl = document.getElementById(`tick_${key}`);
        const chgEl = document.getElementById(`chg_${key}`);

        if (valEl) {
          const prevVal = this.lastIndices[key]?.value;
          valEl.innerText = (key === 'GOLD_24K' || key === 'USD_INR') ? `₹ ${item.value.toLocaleString('en-IN')}` : item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 });
          
          if (prevVal !== undefined && prevVal !== item.value) {
            valEl.classList.remove("flash-tick-up", "flash-tick-down");
            void valEl.offsetWidth; // trigger reflow
            valEl.classList.add(item.direction === "up" ? "flash-tick-up" : "flash-tick-down");
          }
        }

        if (chgEl) {
          chgEl.className = `ticker-change ${item.change_pct >= 0 ? 'up' : 'down'}`;
          chgEl.innerText = `${item.change_pct >= 0 ? '+' : ''}${item.change_pct.toFixed(2)}%`;
        }
      }
      this.lastIndices = tickData.indices;
    }

    const timeEl = document.getElementById("tickerLastUpdate");
    if (timeEl && tickData.timestamp) {
      timeEl.innerText = `Live: ${tickData.timestamp}`;
    }

    // 2. Micro-update active portfolio totals if present
    if (tickData.portfolio_tick && activePortfolio) {
      const pTick = tickData.portfolio_tick;
      const kpiVal = document.getElementById("kpiTotalValuation");
      if (kpiVal) {
        kpiVal.innerText = WealthAnalytics.formatRupee(pTick.total_valuation);
      }
      const kpiMoM = document.getElementById("kpiMoMDelta");
      if (kpiMoM) {
        const momTotal = (activePortfolio.mom_gain_abs || 0) + (pTick.intraday_delta || 0);
        kpiMoM.innerText = `+${WealthAnalytics.formatRupee(momTotal)}`;
      }
    }

    // 3. Render Real-Time Alerts
    if (tickData.alerts && tickData.alerts.length > 0) {
      this.renderAlerts(tickData.alerts);
    }
  },

  renderAlerts(alerts) {
    const container = document.getElementById("liveAlertsContainer");
    if (!container) return;

    // Show latest alert
    const alert = alerts[0];
    const alertId = `alert_${alert.type}`;
    if (document.getElementById(alertId)) return; // prevent duplicate

    const banner = document.createElement("div");
    banner.id = alertId;
    banner.className = `live-alerts-banner ${alert.level === 'warning' ? 'warning' : ''}`;
    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="font-size:1.2rem;">${alert.type === 'tax' ? '⚖️' : '⚡'}</span>
        <div>
          <strong style="color:#ffffff;">${alert.title}</strong>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">${alert.message}</div>
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:transparent; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer;">&times;</button>
    `;
    container.innerHTML = "";
    container.appendChild(banner);
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  initEventListeners();
  await checkServerStatus();
  await loadAvailableSamples();

  // Load cached or default sample portfolio
  const saved = WealthStorage.getPortfolio();
  if (saved && saved.funds && saved.funds.length > 0) {
    setActivePortfolio(saved);
  } else if (serverSamples.cas) {
    loadSample("cas");
  } else {
    loadSample("groww");
  }

  // Initialize Real-Time Streaming
  WealthLive.init();
});

function initEventListeners() {
  // Tab Switching
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      if (target) {
        target.classList.add("active");
        if (btn.dataset.tab === "tabCharts" && activePortfolio) {
          WealthCharts.initCharts(filterPortfolioByBrokerage(activePortfolio, currentBrokerageFilter));
        }
      }
    });
  });

  // Brokerage Filter Switcher
  document.querySelectorAll(".broker-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".broker-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentBrokerageFilter = pill.dataset.broker;
      renderDashboard();
    });
  });

  // Dropzone drag & drop
  const dropzone = document.getElementById("statementDropzone");
  const fileInput = document.getElementById("statementFileInput");

  if (dropzone && fileInput) {
    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("drag-over");
    });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("drag-over");
      if (e.dataTransfer.files.length > 0) {
        handleFileUpload(e.dataTransfer.files[0]);
      }
    });
    fileInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0]);
      }
    });
  }

  // Paste Text Modal trigger
  document.getElementById("btnOpenPasteModal")?.addEventListener("click", () => {
    openModal("pasteModal");
  });

  // API Key Modal trigger
  document.getElementById("btnOpenKeyModal")?.addEventListener("click", () => {
    const savedKey = WealthStorage.getApiKey();
    const input = document.getElementById("apiKeyInput");
    if (input) input.value = savedKey;
    openModal("apiKeyModal");
  });

  // WhatsApp Modal trigger
  document.getElementById("btnOpenWhatsAppModal")?.addEventListener("click", () => {
    updateWhatsAppPreview();
    openModal("whatsAppModal");
  });

  // Export Markdown
  document.getElementById("btnExportMarkdown")?.addEventListener("click", exportMarkdownReport);

  // Print / PDF
  document.getElementById("btnPrintPdf")?.addEventListener("click", () => window.print());

  // Chat Send
  document.getElementById("chatSendBtn")?.addEventListener("click", sendChatMessage);
  document.getElementById("chatInputField")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });

  // Chat Prompt Pills
  document.querySelectorAll(".prompt-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      const input = document.getElementById("chatInputField");
      if (input) {
        input.value = pill.innerText;
        sendChatMessage();
      }
    });
  });

  // Generate Briefing Button
  document.getElementById("btnRefreshBriefing")?.addEventListener("click", generatePortfolioBriefing);
}

async function checkServerStatus() {
  try {
    const res = await fetch("/api/status");
    if (res.ok) {
      const data = await res.json();
      const badge = document.getElementById("serverStatusBadge");
      if (badge) {
        badge.className = "badge badge-success";
        badge.innerHTML = `● Server Online :${data.port}`;
      }
      if (data.has_key && !WealthStorage.getApiKey()) {
        const keyBadge = document.getElementById("apiKeyBadge");
        if (keyBadge) {
          keyBadge.className = "badge badge-purple";
          keyBadge.innerHTML = `🔑 Gemini Active`;
        }
      }
    }
  } catch (e) {
    const badge = document.getElementById("serverStatusBadge");
    if (badge) {
      badge.className = "badge badge-warning";
      badge.innerHTML = `● Offline Fallback`;
    }
  }
}

async function loadAvailableSamples() {
  try {
    const res = await fetch("/api/samples");
    if (res.ok) {
      serverSamples = await res.json();
    }
  } catch (e) {
    console.warn("Could not fetch server samples:", e);
  }
}

async function loadSample(sampleKey) {
  let text = "";
  if (serverSamples[sampleKey]) {
    text = serverSamples[sampleKey].content;
  } else {
    showNotification("Loading sample statement...", "info");
    try {
      const res = await fetch(`/python_agent/sample_statements/${sampleKey === 'cas' ? 'cams_cas_summary.json' : (sampleKey === 'groww' ? 'groww_monthly_sip.txt' : (sampleKey === 'paytm' ? 'paytm_money_valuation.txt' : 'angel_one_trade_report.txt'))}`);
      if (res.ok) text = await res.text();
    } catch (e) {}
  }

  if (text) {
    try {
      const parsed = await WealthParser.parseStatement(text);
      setActivePortfolio(parsed);
      showNotification(`Loaded ${parsed.statement_type || sampleKey} successfully!`, "success");
      
      // Proactively sync live NAVs
      syncLiveAMFINAVs(false);
    } catch (e) {
      showNotification(`Failed to parse sample: ${e.message}`, "error");
    }
  }
}

function setActivePortfolio(portfolio) {
  activePortfolio = portfolio;
  WealthStorage.savePortfolio(portfolio);
  currentBrokerageFilter = "ALL";
  document.querySelectorAll(".broker-pill").forEach(p => {
    p.classList.toggle("active", p.dataset.broker === "ALL");
  });

  // Notify backend server of active portfolio for live ticks
  fetch("/api/set-active-portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ portfolio })
  }).catch(() => {});

  renderDashboard();
  generatePortfolioBriefing();
}

async function syncLiveAMFINAVs(showToast = true) {
  if (!activePortfolio) return;

  const badge = document.getElementById("liveSyncStatusBadge");
  if (badge) {
    badge.className = "badge badge-cyan";
    badge.innerHTML = `<div class="spinner" style="display:inline-block; width:10px; height:10px; margin-right:4px;"></div> Syncing AMFI NAVs...`;
  }

  try {
    const res = await fetch("/api/fetch-live-navs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ portfolio: activePortfolio })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.portfolio) {
        activePortfolio = data.portfolio;
        WealthStorage.savePortfolio(activePortfolio);
        renderDashboard();

        if (badge) {
          badge.className = "badge badge-success";
          badge.innerHTML = `● AMFI Live Synced (${data.synced_count || activePortfolio.funds.length} Funds)`;
        }

        if (showToast) {
          showNotification(`⚡ Successfully synced ${data.synced_count || 0} mutual funds with live AMFI NAVs!`, "success");
        }
        return;
      }
    }
  } catch (e) {
    console.warn("Live NAV fetch failed:", e);
  }

  if (badge) {
    badge.className = "badge badge-warning";
    badge.innerHTML = `● Cached NAVs`;
  }
}

function filterPortfolioByBrokerage(portfolio, filter) {
  if (!portfolio || filter === "ALL") return portfolio;
  
  const filteredFunds = (portfolio.funds || []).filter(f => {
    const b = (f.brokerage || "").toLowerCase();
    if (filter === "GROWW") return b.includes("groww");
    if (filter === "PAYTM") return b.includes("paytm");
    if (filter === "ANGEL") return b.includes("angel");
    return true;
  });

  const totalInv = filteredFunds.reduce((a, f) => a + (f.invested_value || 0), 0);
  const totalVal = filteredFunds.reduce((a, f) => a + (f.current_value || 0), 0);
  const momAbs = filteredFunds.reduce((a, f) => a + (f.mom_gain_abs || 0), 0);
  const prevVal = totalVal - momAbs;
  const momPct = prevVal > 0 ? ((momAbs / prevVal) * 100) : 3.5;
  const monthlySip = filteredFunds.reduce((a, f) => a + (f.sip_amount || 0), 0);

  const customPortfolio = {
    ...portfolio,
    statement_type: `${filter} Filtered Portfolio`,
    total_invested: totalInv,
    total_valuation: totalVal,
    total_unrealized_gain: totalVal - totalInv,
    overall_gain_pct: totalInv > 0 ? (((totalVal - totalInv) / totalInv) * 100) : 0,
    mom_gain_abs: momAbs,
    mom_gain_pct: momPct,
    monthly_sip_outflow: monthlySip,
    active_sips_count: filteredFunds.filter(f => f.sip_amount > 0).length,
    funds: filteredFunds
  };

  return WealthAnalytics.enrichPortfolio(customPortfolio);
}

function renderDashboard() {
  if (!activePortfolio) return;
  const p = filterPortfolioByBrokerage(activePortfolio, currentBrokerageFilter);

  // Render KPIs
  document.getElementById("kpiTotalValuation").innerText = WealthAnalytics.formatRupee(p.total_valuation);
  document.getElementById("kpiInvested").innerText = WealthAnalytics.formatRupee(p.total_invested);
  
  const gainEl = document.getElementById("kpiGain");
  gainEl.innerText = `${p.total_unrealized_gain >= 0 ? '+' : ''}${WealthAnalytics.formatRupee(p.total_unrealized_gain)}`;
  document.getElementById("kpiGainPct").innerText = `(${p.overall_gain_pct?.toFixed(2)}% Absolute)`;

  const momEl = document.getElementById("kpiMoMDelta");
  momEl.innerText = `+${WealthAnalytics.formatRupee(p.mom_gain_abs)}`;
  
  const momBadge = document.getElementById("kpiMoMBadge");
  momBadge.className = `delta-badge ${p.mom_gain_pct >= 0 ? 'positive' : 'negative'}`;
  momBadge.innerHTML = `⚡ ${p.mom_gain_pct >= 0 ? '+' : ''}${p.mom_gain_pct?.toFixed(2)}% MoM`;

  document.getElementById("kpiXirr").innerText = `${p.portfolio_xirr?.toFixed(2)}%`;
  document.getElementById("kpiSip").innerText = WealthAnalytics.formatRupee(p.monthly_sip_outflow);
  document.getElementById("kpiSipCount").innerText = `${p.active_sips_count || p.funds.length} Active SIPs`;

  document.getElementById("kpiHealthScore").innerText = `${p.health_score || 94}/100`;
  document.getElementById("kpiHealthStatus").innerText = p.health_status || "Strong Momentum";

  // Subtitle info
  const syncedNotice = p.last_synced_at ? ` • Live AMFI Sync: ${p.last_synced_at}` : '';
  document.getElementById("statementMetaInfo").innerText = `${p.statement_type || 'Statement'} • Period: ${p.as_of_date || 'August 2026'} • Investor: ${p.investor_name || 'Client'}${syncedNotice}`;

  // Render Fund Table
  renderFundTable(p.funds || []);

  // Render Charts
  WealthCharts.initCharts(p);
}

function renderFundTable(funds) {
  const tbody = document.getElementById("fundTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (funds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:var(--text-muted);">No funds found for this filter.</td></tr>`;
    return;
  }

  funds.forEach((f, idx) => {
    const tr = document.createElement("tr");

    let catClass = "cat-tech";
    if (/mid/i.test(f.category)) catClass = "cat-mid";
    else if (/small/i.test(f.category)) catClass = "cat-small";
    else if (/large/i.test(f.category)) catClass = "cat-large";
    else if (/hybrid/i.test(f.category)) catClass = "cat-hybrid";

    const momPct = f.mom_gain_pct || 0;
    const heatClass = momPct >= 4.5 ? "heat-high-green" : (momPct >= 2.0 ? "heat-med-green" : (momPct < 0 ? "heat-red" : ""));
    const liveNavLabel = f.live_nav ? `₹ ${f.live_nav.toFixed(2)}` : 'Live';
    const dayChangeBadge = f.day_change_pct ? `<span style="font-size:0.7rem; color:${f.day_change_pct >= 0 ? 'var(--accent-mint)' : 'var(--accent-rose)'}; margin-left:4px;">(${f.day_change_pct >= 0 ? '+' : ''}${f.day_change_pct}%)</span>` : '';

    tr.innerHTML = `
      <td>
        <div class="fund-cell-name">${f.name}</div>
        <div class="fund-cell-sub">
          ${f.amc || 'Mutual Fund AMC'} • Folio: ${f.folio || 'N/A'} • <span style="color:var(--accent-cyan);">${f.brokerage || 'Direct'}</span>
          ${f.is_live_synced ? `<span style="color:var(--accent-mint); font-size:0.7rem; margin-left:6px;">● NAV: ${liveNavLabel}${dayChangeBadge}</span>` : ''}
        </div>
      </td>
      <td><span class="cat-tag ${catClass}">${f.category}</span></td>
      <td class="mono font-bold" style="color:#ffffff;">${WealthAnalytics.formatRupee(f.current_value)}</td>
      <td class="mono text-muted">${WealthAnalytics.formatRupee(f.invested_value)}</td>
      <td>
        <span class="heat-badge ${heatClass}">+${momPct.toFixed(2)}%</span>
        <div style="font-size:0.72rem; color:var(--accent-mint); margin-top:2px;">+${WealthAnalytics.formatCompactRupee(f.mom_gain_abs)}</div>
      </td>
      <td class="mono font-bold" style="color:var(--accent-gold);">${f.xirr_pct ? f.xirr_pct + '%' : '18.5%'}</td>
      <td>
        <div class="mono" style="font-weight:600;">${f.sip_amount > 0 ? WealthAnalytics.formatRupee(f.sip_amount) + '/mo' : '<span style="color:var(--text-dim);">Lump Sum</span>'}</div>
        <div style="font-size:0.72rem; color:var(--text-muted);">${f.sip_date ? 'Date: ' + f.sip_date : ''}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function generatePortfolioBriefing() {
  if (!activePortfolio) return;
  const container = document.getElementById("aiBriefingText");
  const sourceTag = document.getElementById("aiSourceBadge");
  if (container) {
    container.innerHTML = `<div style="display:flex; align-items:center; gap:10px; color:var(--accent-mint);"><div class="spinner"></div> Synthesizing AI executive portfolio health briefing...</div>`;
  }

  const p = filterPortfolioByBrokerage(activePortfolio, currentBrokerageFilter);
  const apiKey = WealthStorage.getApiKey();

  try {
    const result = await WealthAgent.generateBriefing(p, apiKey);
    if (container) {
      container.innerHTML = renderMarkdown(result.briefing);
    }
    if (sourceTag) {
      sourceTag.innerText = result.source === "gemini-3.7-flash" ? "✨ Gemini 3.7 Flash" : "⚡ Local Synthesis Engine";
      sourceTag.className = result.source === "gemini-3.7-flash" ? "badge badge-purple" : "badge badge-success";
    }
  } catch (e) {
    if (container) container.innerHTML = `<p style="color:var(--accent-rose);">Failed to generate briefing: ${e.message}</p>`;
  }
}

async function sendChatMessage() {
  const input = document.getElementById("chatInputField");
  if (!input || !input.value.trim() || !activePortfolio) return;

  const msg = input.value.trim();
  input.value = "";

  const chatContainer = document.getElementById("chatMessages");
  appendChatBubble("user", msg);

  const bubble = appendChatBubble("assistant", '<span class="spinner" style="display:inline-block; width:12px; height:12px; margin-right:6px;"></span> Analyzing live portfolio data...');
  const apiKey = WealthStorage.getApiKey();
  const p = filterPortfolioByBrokerage(activePortfolio, currentBrokerageFilter);

  try {
    let hasStarted = false;
    await WealthAgent.streamChatMessage(msg, p, apiKey, (accumulatedText) => {
      if (!hasStarted) {
        hasStarted = true;
      }
      bubble.innerHTML = renderMarkdown(accumulatedText) + '<span class="chat-streaming-cursor"></span>';
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    // Remove streaming cursor on finish
    const cursor = bubble.querySelector(".chat-streaming-cursor");
    if (cursor) cursor.remove();
  } catch (e) {
    bubble.innerHTML = `<span style="color:var(--accent-rose);">Error: ${e.message}</span>`;
  }

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function appendChatBubble(sender, text) {
  const container = document.getElementById("chatMessages");
  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender}`;
  bubble.innerHTML = renderMarkdown(text);
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const content = e.target.result;
    try {
      showNotification(`Processing ${file.name}...`, "info");
      const parsed = await WealthParser.parseStatement(content, file.name);
      setActivePortfolio(parsed);
      showNotification(`Successfully ingested ${file.name}!`, "success");
      syncLiveAMFINAVs(false);
    } catch (err) {
      showNotification(`Ingestion failed: ${err.message}`, "error");
    }
  };
  reader.readAsText(file);
}

function parsePastedStatement() {
  const textarea = document.getElementById("pasteStatementText");
  if (!textarea || !textarea.value.trim()) {
    alert("Please paste statement content.");
    return;
  }
  const text = textarea.value.trim();
  closeModal("pasteModal");
  showNotification("Parsing statement...", "info");

  WealthParser.parseStatement(text).then(parsed => {
    setActivePortfolio(parsed);
    showNotification("Statement parsed successfully!", "success");
    textarea.value = "";
    syncLiveAMFINAVs(false);
  }).catch(err => {
    showNotification(`Parsing error: ${err.message}`, "error");
  });
}

function saveApiKeyFromModal() {
  const input = document.getElementById("apiKeyInput");
  const key = input ? input.value.trim() : "";
  WealthStorage.saveApiKey(key);
  
  // Also save to server .env
  fetch("/api/save-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key })
  }).then(() => checkServerStatus());

  closeModal("apiKeyModal");
  showNotification(key ? "Gemini API key configured!" : "API key cleared. Using local synthesis.", "success");
  generatePortfolioBriefing();
}

function updateWhatsAppPreview() {
  if (!activePortfolio) return;
  const p = filterPortfolioByBrokerage(activePortfolio, currentBrokerageFilter);
  const contact = WealthStorage.getContactInfo();

  const text = `*🌟 WealthPulse AI — Monthly Portfolio Briefing*\n` +
    `👤 *Investor:* ${p.investor_name || 'Client'}\n` +
    `📅 *Period:* ${p.as_of_date || 'August 2026'}\n\n` +
    `💰 *Total Portfolio:* ${WealthAnalytics.formatRupee(p.total_valuation)}\n` +
    `📈 *Unrealized Gain:* +${WealthAnalytics.formatRupee(p.total_unrealized_gain)} (+${p.overall_gain_pct?.toFixed(2)}%)\n` +
    `⚡ *MoM Growth:* +${WealthAnalytics.formatRupee(p.mom_gain_abs)} (+${p.mom_gain_pct?.toFixed(2)}%)\n` +
    `🔄 *Monthly SIPs:* ${WealthAnalytics.formatRupee(p.monthly_sip_outflow)} (${p.active_sips_count || p.funds.length} funds)\n` +
    `🏆 *Portfolio XIRR:* ${p.portfolio_xirr?.toFixed(2)}%\n` +
    `🛡️ *Health Score:* ${p.health_score || 94}/100 (${p.health_status || 'Strong'})\n\n` +
    `*Top Performers this month:*\n` +
    (p.funds || []).slice(0, 3).map(f => `• ${f.name}: +${f.mom_gain_pct?.toFixed(2)}% MoM`).join("\n") +
    `\n\n_Generated via WealthPulse AI Assistant_`;

  const preview = document.getElementById("whatsAppMessagePreview");
  if (preview) preview.value = text;

  const linkBtn = document.getElementById("btnSendWhatsAppDirect");
  if (linkBtn) {
    const cleanPhone = (contact.phone || "").replace(/[^\d]/g, "");
    linkBtn.href = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  }
}

function exportMarkdownReport() {
  if (!activePortfolio) return;
  const p = filterPortfolioByBrokerage(activePortfolio, currentBrokerageFilter);
  const briefing = document.getElementById("aiBriefingText")?.innerText || "";
  
  const md = `# WealthPulse AI — Financial Portfolio Report
**Date:** ${p.as_of_date || 'August 2026'} | **Investor:** ${p.investor_name || 'Client'} | **Brokerage Filter:** ${currentBrokerageFilter}

## Portfolio Valuation Summary
- **Total Market Value:** ${WealthAnalytics.formatRupee(p.total_valuation)}
- **Invested Capital:** ${WealthAnalytics.formatRupee(p.total_invested)}
- **Unrealized Gain:** +${WealthAnalytics.formatRupee(p.total_unrealized_gain)} (+${p.overall_gain_pct?.toFixed(2)}%)
- **Month-over-Month (MoM) Growth:** +${WealthAnalytics.formatRupee(p.mom_gain_abs)} (+${p.mom_gain_pct?.toFixed(2)}%)
- **Portfolio XIRR:** ${p.portfolio_xirr?.toFixed(2)}%
- **Total Monthly Active SIPs:** ${WealthAnalytics.formatRupee(p.monthly_sip_outflow)}

## Fund Holdings Ledger
| Fund Name | Category | Current Value (₹) | MoM Gain (%) | XIRR (%) | Monthly SIP (₹) |
|---|---|---|---|---|---|
${(p.funds || []).map(f => `| ${f.name} | ${f.category} | ₹ ${f.current_value?.toLocaleString('en-IN')} | +${f.mom_gain_pct?.toFixed(2)}% | ${f.xirr_pct}% | ₹ ${f.sip_amount?.toLocaleString('en-IN')} |`).join("\n")}

## AI Executive Briefing
${briefing}
`;

  const blob = new Blob([md], { type: "text/markdown" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `WealthPulse_Portfolio_Report_${Date.now()}.md`;
  a.click();
}

// Modal Helpers
function openModal(id) {
  document.getElementById(id)?.classList.add("active");
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove("active");
}

function showNotification(msg, type = "info") {
  const toast = document.getElementById("appToast");
  if (!toast) return;
  toast.innerText = msg;
  toast.className = `app-toast show ${type}`;
  setTimeout(() => toast.className = "app-toast", 3500);
}

// Simple Markdown to HTML Formatter
function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<li>$1</li>')
    .replace(/• (.*$)/gim, '<li>$1</li>')
    .replace(/\n\n/gim, '<br><br>')
    .replace(/\n/gim, '<br>');
  return html;
}
