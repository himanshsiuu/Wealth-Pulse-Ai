# 💎 WealthPulse AI — Autonomous Portfolio & SIP Intelligence Agent

> **Personal wealth intelligence platform** that ingests unstructured monthly valuation summaries, trade reports, and SIP statements from diverse brokerages (Groww, Paytm Money, Angel One, Zerodha, CAMS/KFintech CAS), calculates month-over-month (MoM) growth across asset classes & specific thematic funds (Midcap, Smallcap, Sectoral Tech/Digital), and generates concise natural language executive briefings of portfolio health powered by Google Gemini 3.7 Flash and a local deterministic synthesis engine.

---

## ✨ Key Capabilities

### 1. 📥 Multi-Brokerage Ingestion Engine
- **Unstructured Statement Extraction**: Ingests messy PDF valuation reports, monthly trade emails, SMS/contract notes, and multi-AMC Consolidated Account Statements (CAS).
- **Supported Brokerages**: Pre-configured parsers for **Groww**, **Paytm Money**, **Angel One**, **Zerodha Coin**, and **CAMS / KFintech**.
- **Pre-Loaded Sample Datasets**: 1-click loaders for Groww, Paytm Money, Angel One, and Consolidated CAS statements covering **11 funds across 5 major categories**.

### 2. ⚡ Month-over-Month (MoM) Growth & Fund Performance
- **Granular MoM Deltas**: Absolute (₹) and percentage (%) monthly gains calculated per scheme and aggregated across asset categories.
- **Category Intelligence**:
  - *Sectoral - Digital & Technology* (e.g. Tata Digital India, ICICI Prudential Technology)
  - *Mid Cap Funds* (e.g. Motilal Oswal Midcap, HDFC Mid-Cap Opportunities)
  - *Small Cap Funds* (e.g. Quant Small Cap, Nippon India Small Cap)
  - *Large Cap & Index Funds* (e.g. UTI Nifty 50, Mirae Asset Large Cap)
  - *Flexi Cap & Hybrid Allocation* (e.g. Parag Parikh Flexi Cap, HDFC Balanced Advantage, SBI Equity Hybrid)
- **Benchmark Alpha**: Automatic comparison against Nifty 50 and Nifty Midcap 150 indices.

### 3. 🤖 AI Portfolio Health Briefing & Interactive Copilot
- **Executive Health Briefings**: Automated narrative reports synthesizing top growth drivers, compounding efficiency, and risk concentrations.
- **Conversational Wealth Copilot**: Interactive chat powered by Google Gemini 3.7 Flash (with zero-dependency offline synthesis fallback) to answer fund comparisons, tax harvesting questions (utilizing the ₹1.25L LTCG annual exemption), and SIP compounding milestones.
- **WhatsApp 1-Click Dispatch**: Formats concise structured briefings ready for 1-click delivery to clients, family, or personal archives via WhatsApp Web/App.

### 4. 📊 Visual Analytics & Heatmaps
- **Portfolio Growth Trajectory**: Valuation vs Invested Capital timeline.
- **Category Allocation Donut**: Visual exposure breakdown.
- **Fund MoM Gain Ranking**: Color-coded performance bars.
- **Performance Matrix Table**: Sortable ledger with live heatmaps, NAV history, and SIP status.

---

## 🚀 Quick Start

### 1. Launch the Web Application (Port 8083)
```bash
cd /Users/priyanshudubey/Desktop/wealth-pulse-agent
python3 run_server.py
```
Open **[http://localhost:8083](http://localhost:8083)** in your browser.

### 2. Run the Standalone Python CLI Agent
```bash
# Generate AI Executive Briefing on Groww Statement
python3 python_agent/wealth_agent.py --sample groww --briefing

# Ingest an External Statement File & Export Markdown Report
python3 python_agent/wealth_agent.py --file path/to/statement.txt --export-md report.md

# View Full Consolidated Multi-Brokerage Matrix
python3 python_agent/wealth_agent.py --sample cas --mom
```

---

## 📁 Project Architecture

```
wealth-pulse-agent/
├── index.html                      # Main Wealth Intelligence Dashboard
├── css/
│   ├── style.css                   # Core tokens, obsidian & emerald palette, typography
│   └── components.css              # KPI cards, table heatmaps, dropzone, chat copilot, modals
├── js/
│   ├── app.js                      # Main coordinator, sample loader, filter actions, export logic
│   ├── parser.js                   # Client & hybrid statement parser
│   ├── analytics.js                # MoM calculation engine, XIRR, category exposure, health score
│   ├── agent.js                    # Gemini 3.7 API integration & local synthesis engine
│   ├── charts.js                   # Chart.js visualizer for growth, allocation, and benchmarks
│   └── storage.js                  # LocalStorage state management
├── python_agent/
│   ├── wealth_agent.py             # Standalone Python CLI agent
│   ├── statement_parser.py         # Regex, text tokenizer & normalization engine
│   ├── requirements.txt            # Optional Python dependencies
│   └── sample_statements/          # Realistic multi-brokerage sample statements
│       ├── groww_monthly_sip.txt
│       ├── paytm_money_valuation.txt
│       ├── angel_one_trade_report.txt
│       └── cams_cas_summary.json
├── run_server.py                   # Multi-threaded Python server & API backend (Port 8083)
├── .env.example                    # Template for optional GEMINI_API_KEY
└── README.md                       # Documentation
```

---

## 🔑 Google Gemini API Configuration (Optional)

WealthPulse AI works **100% offline out-of-the-box** using its built-in deterministic financial engine.

To enable live Google Gemini 3.7 Flash reasoning:
1. Click the **Key icon (🔑)** in the top navigation bar.
2. Enter your Gemini API key (or set `GEMINI_API_KEY=...` in `.env`).
3. The platform will automatically switch to Gemini 3.7 Flash inference.
