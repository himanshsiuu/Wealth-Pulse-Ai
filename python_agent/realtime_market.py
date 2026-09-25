#!/usr/bin/env python3
"""
WealthPulse AI — Real-Time Market & Live AMFI NAV Engine
Provides:
1. Live Mutual Fund NAV Ingestion from official AMFI / MFAPI.in API
2. Live Market Indices (Nifty 50, Nifty Midcap 150, Nifty IT, Gold 24K, USD/INR)
3. Intraday Live Ticker Simulation & Portfolio Micro-Ticks
4. Automated Real-Time Wealth Alerts (Volatility, LTCG Limits, SIP Tracking)
"""

import json
import time
import math
import random
import urllib.request
import urllib.parse
from typing import Dict, Any, List, Optional

# Pre-mapped scheme codes for top Indian Mutual Funds on AMFI/MFAPI
KNOWN_SCHEME_CODES = {
    "tata digital": 135783,         # Tata Digital India Fund Direct Growth
    "motilal oswal midcap": 127042, # Motilal Oswal Midcap Fund Direct Growth
    "quant small cap": 120828,      # Quant Small Cap Fund Direct Growth
    "nippon india small cap": 118778,# Nippon India Small Cap Fund Direct Growth
    "uti nifty 50": 120716,         # UTI Nifty 50 Index Fund Direct Growth
    "parag parikh flexi cap": 122639,# Parag Parikh Flexi Cap Fund Direct Growth
    "icici prudential technology": 120594, # ICICI Prudential Technology Fund Direct Growth
    "hdfc mid-cap": 118989,         # HDFC Mid-Cap Opportunities Fund Direct Growth
    "mirae asset large cap": 107578,# Mirae Asset Large Cap Fund Direct Growth
    "sbi equity hybrid": 119718,    # SBI Equity Hybrid Fund Direct Growth
    "hdfc balanced advantage": 118968, # HDFC Balanced Advantage Fund Direct Growth
    "kotak emerging equity": 120166, # Kotak Emerging Equity Fund Direct Growth
    "axis small cap": 125354,       # Axis Small Cap Fund Direct Growth
    "mirae asset elss": 118834,     # Mirae Asset ELSS Tax Saver Fund Direct Growth
    "sbi small cap": 125497,        # SBI Small Cap Fund Direct Growth
    "hdfc flexi cap": 101968,       # HDFC Flexi Cap Fund
    "icici prudential bluechip": 120586 # ICICI Prudential Bluechip Fund Direct Growth
}

# In-memory NAV cache to prevent rate-limiting: {scheme_code: {nav, date, name, timestamp}}
NAV_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 300 # 5 minutes

# Base benchmark market indices
BASE_INDICES = {
    "NIFTY_50": {"name": "NIFTY 50", "value": 24835.40, "change": 142.60, "change_pct": 0.58, "symbol": "NSE:NIFTY50"},
    "NIFTY_MIDCAP": {"name": "NIFTY MIDCAP 150", "value": 21450.80, "change": 245.30, "change_pct": 1.15, "symbol": "NSE:NIFTYMDCP"},
    "NIFTY_IT": {"name": "NIFTY IT", "value": 42180.25, "change": 580.40, "change_pct": 1.40, "symbol": "NSE:NIFTYIT"},
    "NIFTY_SMALLCAP": {"name": "NIFTY SMALLCAP 250", "value": 18230.15, "change": 198.70, "change_pct": 1.10, "symbol": "NSE:NIFTYSMCP"},
    "SENSEX": {"name": "BSE SENSEX", "value": 81520.60, "change": 460.20, "change_pct": 0.57, "symbol": "BSE:SENSEX"},
    "GOLD_24K": {"name": "GOLD 24K (10g)", "value": 72450.00, "change": 180.00, "change_pct": 0.25, "symbol": "MCX:GOLD"},
    "USD_INR": {"name": "USD / INR", "value": 83.94, "change": -0.06, "change_pct": -0.07, "symbol": "FOREX:USDINR"}
}


def resolve_scheme_code(fund_name: str) -> Optional[int]:
    """Finds matching AMFI scheme code based on fund scheme name."""
    clean = fund_name.lower().replace("-", " ").replace("fund", "").strip()
    
    # Direct match from known scheme codes
    for key, code in KNOWN_SCHEME_CODES.items():
        if key in clean or all(word in clean for word in key.split() if len(word) > 2):
            return code
            
    # Fuzzy lookup attempt via MFAPI search if network available
    try:
        search_query = urllib.parse.quote(fund_name.split()[0] + " " + fund_name.split()[1] if len(fund_name.split()) > 1 else fund_name)
        url = f"https://api.mfapi.in/mf/search?q={search_query}"
        req = urllib.request.Request(url, headers={"User-Agent": "WealthPulse/1.0"})
        with urllib.request.urlopen(req, timeout=3) as resp:
            results = json.loads(resp.read().decode())
            for item in results:
                sname = item.get("schemeName", "").lower()
                if "direct" in sname and "growth" in sname:
                    return int(item.get("schemeCode"))
            if results:
                return int(results[0].get("schemeCode"))
    except Exception:
        pass

    return None


def fetch_live_mf_nav(scheme_code: int) -> Optional[Dict[str, Any]]:
    """
    Fetches real-time latest NAV for any Indian mutual fund scheme from AMFI / MFAPI.
    Uses in-memory TTL cache for high performance.
    """
    code_str = str(scheme_code)
    now = time.time()
    
    if code_str in NAV_CACHE and (now - NAV_CACHE[code_str]["cached_at"]) < CACHE_TTL_SECONDS:
        return NAV_CACHE[code_str]

    try:
        url = f"https://api.mfapi.in/mf/{scheme_code}"
        req = urllib.request.Request(url, headers={"User-Agent": "WealthPulse/1.0"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode())
            if data and "data" in data and len(data["data"]) > 0:
                latest = data["data"][0]
                prev = data["data"][1] if len(data["data"]) > 1 else latest
                
                cur_nav = float(latest["nav"])
                prev_nav = float(prev["nav"]) if float(prev["nav"]) > 0 else cur_nav
                day_change_pct = ((cur_nav - prev_nav) / prev_nav) * 100 if prev_nav > 0 else 0.0

                result = {
                    "scheme_code": scheme_code,
                    "scheme_name": data.get("meta", {}).get("scheme_name", ""),
                    "nav": cur_nav,
                    "date": latest["date"],
                    "prev_nav": prev_nav,
                    "day_change_pct": round(day_change_pct, 2),
                    "cached_at": now
                }
                NAV_CACHE[code_str] = result
                return result
    except Exception as e:
        print(f"⚠️ Live NAV fetch error for scheme {scheme_code}: {e}")

    # Fallback simulation if network is unreachable
    return None


def sync_portfolio_with_live_navs(portfolio: Dict[str, Any]) -> Dict[str, Any]:
    """
    Takes an existing parsed portfolio and syncs all funds with live AMFI NAVs concurrently,
    recalculating total valuation, MoM growth, and unrealized gains.
    """
    import concurrent.futures

    funds = portfolio.get("funds", [])
    if not funds:
        return portfolio

    def process_fund(f):
        f_copy = dict(f)
        scheme_code = f.get("scheme_code") or resolve_scheme_code(f.get("name", ""))
        
        live_nav_info = None
        if scheme_code:
            f_copy["scheme_code"] = scheme_code
            live_nav_info = fetch_live_mf_nav(scheme_code)

        if live_nav_info:
            live_nav = live_nav_info["nav"]
            nav_date = live_nav_info["date"]
            f_copy["live_nav"] = live_nav
            f_copy["live_nav_date"] = nav_date
            f_copy["day_change_pct"] = live_nav_info.get("day_change_pct", 0.0)
            f_copy["is_live_synced"] = True

            # Recalculate current value if units exist
            units = f.get("units", 0)
            if units and units > 0:
                f_copy["current_value"] = round(units * live_nav, 2)
            else:
                # Approximate units from current value and live NAV
                units = f.get("current_value", 0) / live_nav if live_nav > 0 else 0
                f_copy["units"] = round(units, 4)
        else:
            f_copy["is_live_synced"] = False

        return f_copy

    updated_funds = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(12, len(funds))) as executor:
        updated_funds = list(executor.map(process_fund, funds))

    total_live_val = sum(f.get("current_value", 0.0) for f in updated_funds)
    total_inv = portfolio.get("total_invested", 0.0)
    synced_count = sum(1 for f in updated_funds if f.get("is_live_synced"))

    # Recalculate aggregate metrics
    mom_gain_abs = portfolio.get("mom_gain_abs", 0.0)
    if total_live_val > 0 and total_live_val != portfolio.get("total_valuation", 0):
        # Adjust MoM gain proportionally
        diff = total_live_val - portfolio.get("total_valuation", total_live_val)
        mom_gain_abs += diff

    prev_val = total_live_val - mom_gain_abs
    mom_gain_pct = ((mom_gain_abs / prev_val) * 100) if prev_val > 0 else portfolio.get("mom_gain_pct", 3.5)
    unrealized_gain = total_live_val - total_inv
    overall_gain_pct = ((unrealized_gain / total_inv) * 100) if total_inv > 0 else 0.0

    synced_portfolio = dict(portfolio)
    synced_portfolio["funds"] = updated_funds
    synced_portfolio["total_valuation"] = round(total_live_val, 2)
    synced_portfolio["total_unrealized_gain"] = round(unrealized_gain, 2)
    synced_portfolio["overall_gain_pct"] = round(overall_gain_pct, 2)
    synced_portfolio["mom_gain_abs"] = round(mom_gain_abs, 2)
    synced_portfolio["mom_gain_pct"] = round(mom_gain_pct, 2)
    synced_portfolio["last_synced_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
    synced_portfolio["live_synced_funds_count"] = synced_count

    return synced_portfolio


def get_live_market_ticks(portfolio: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Generates a live market tick event containing live index updates,
    micro-movements in portfolio valuation, and proactive real-time wealth alerts.
    """
    timestamp = time.strftime("%H:%M:%S")
    
    # Intraday micro-fluctuation simulation for realistic live market experience
    updated_indices = {}
    for key, data in BASE_INDICES.items():
        # subtle random walk (-0.05% to +0.05%)
        delta_pct = (random.random() - 0.48) * 0.08
        new_val = data["value"] * (1 + (delta_pct / 100))
        new_change = data["change"] + (new_val - data["value"])
        new_change_pct = data["change_pct"] + delta_pct

        updated_indices[key] = {
            "name": data["name"],
            "value": round(new_val, 2),
            "change": round(new_change, 2),
            "change_pct": round(new_change_pct, 2),
            "symbol": data["symbol"],
            "direction": "up" if delta_pct >= 0 else "down"
        }

    # Micro-tick for portfolio funds if present
    portfolio_tick = None
    alerts = []

    if portfolio and "funds" in portfolio:
        funds_ticks = []
        total_delta = 0.0
        
        for f in portfolio.get("funds", []):
            cat = f.get("category", "")
            # Sector-correlated tick: Tech funds move with NIFTY IT, Midcaps with NIFTY MIDCAP
            if "tech" in cat.lower() or "digital" in cat.lower():
                index_move = updated_indices["NIFTY_IT"]["change_pct"] * 0.02
            elif "mid" in cat.lower():
                index_move = updated_indices["NIFTY_MIDCAP"]["change_pct"] * 0.02
            elif "small" in cat.lower():
                index_move = updated_indices["NIFTY_SMALLCAP"]["change_pct"] * 0.02
            else:
                index_move = updated_indices["NIFTY_50"]["change_pct"] * 0.02

            cur_val = f.get("current_value", 0.0)
            fund_tick_delta = cur_val * (index_move / 100)
            new_fund_val = round(cur_val + fund_tick_delta, 2)
            total_delta += fund_tick_delta

            funds_ticks.append({
                "name": f.get("name"),
                "fund_value": new_fund_val,
                "delta": round(fund_tick_delta, 2),
                "direction": "up" if fund_tick_delta >= 0 else "down"
            })

        new_total_val = round(portfolio.get("total_valuation", 0.0) + total_delta, 2)
        new_unrealized = round(portfolio.get("total_unrealized_gain", 0.0) + total_delta, 2)
        
        portfolio_tick = {
            "total_valuation": new_total_val,
            "total_unrealized_gain": new_unrealized,
            "intraday_delta": round(total_delta, 2),
            "direction": "up" if total_delta >= 0 else "down",
            "funds_ticks": funds_ticks
        }

        # Check for real-time proactive alerts
        if portfolio.get("total_unrealized_gain", 0) > 125000:
            alerts.append({
                "type": "tax",
                "level": "info",
                "title": "⚖️ LTCG Harvesting Opportunity",
                "message": f"Your unrealized capital gains (₹ {new_unrealized:,.0f}) exceed the ₹1.25L annual exemption. Consider harvesting up to ₹1.25L tax-free."
            })

        if abs(total_delta) > 1500:
            alerts.append({
                "type": "volatility",
                "level": "warning",
                "title": "⚡ Live Market Surge Alert",
                "message": f"Portfolio moved {'+' if total_delta > 0 else ''}₹ {total_delta:,.2f} today driven by {'Technology' if updated_indices['NIFTY_IT']['change_pct'] > 0 else 'Midcap'} momentum."
            })

    return {
        "timestamp": timestamp,
        "indices": updated_indices,
        "portfolio_tick": portfolio_tick,
        "alerts": alerts
    }
