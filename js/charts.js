/**
 * WealthPulse AI — Visual Charts Engine (Chart.js)
 * Implements interactive, sleek financial charts for portfolio growth,
 * category allocation, MoM returns, and SIP vs benchmark comparisons.
 */

const WealthCharts = {
  growthChart: null,
  allocationChart: null,
  performanceChart: null,
  benchmarkChart: null,

  initCharts(portfolio) {
    this.renderGrowthChart(portfolio);
    this.renderAllocationChart(portfolio);
    this.renderPerformanceChart(portfolio);
    this.renderBenchmarkChart(portfolio);
  },

  renderGrowthChart(portfolio) {
    const ctx = document.getElementById("growthChartCanvas");
    if (!ctx) return;
    if (this.growthChart) this.growthChart.destroy();

    const history = portfolio.monthly_history || [];
    const labels = history.map(h => h.month);
    const valuationData = history.map(h => h.valuation);
    const investedData = history.map(h => h.invested);

    this.growthChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Current Valuation (₹)",
            data: valuationData,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            fill: true,
            tension: 0.35,
            borderWidth: 3,
            pointBackgroundColor: "#10b981",
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: "Invested Capital (₹)",
            data: investedData,
            borderColor: "#06b6d4",
            backgroundColor: "transparent",
            borderDash: [5, 5],
            borderWidth: 2,
            pointBackgroundColor: "#06b6d4",
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#94a3b8", font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: ₹ ${item.raw.toLocaleString('en-IN')}`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8" }
          },
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: {
              color: "#94a3b8",
              callback: (v) => "₹ " + (v >= 100000 ? (v / 100000).toFixed(1) + "L" : (v / 1000).toFixed(0) + "k")
            }
          }
        }
      }
    });
  },

  renderAllocationChart(portfolio) {
    const ctx = document.getElementById("allocationChartCanvas");
    if (!ctx) return;
    if (this.allocationChart) this.allocationChart.destroy();

    const categories = portfolio.categories || [];
    const labels = categories.map(c => c.category);
    const data = categories.map(c => c.current_value);
    
    const palette = [
      "#06b6d4", // Cyan
      "#8b5cf6", // Purple
      "#f59e0b", // Gold
      "#3b82f6", // Blue
      "#10b981", // Emerald
      "#ec4899", // Pink
      "#64748b"  // Slate
    ];

    this.allocationChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: palette.slice(0, labels.length),
            borderWidth: 2,
            borderColor: "#0a1618",
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "right",
            labels: { color: "#94a3b8", font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }, boxWidth: 12 }
          },
          tooltip: {
            callbacks: {
              label: (item) => {
                const val = item.raw;
                const total = data.reduce((a, b) => a + b, 0);
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return `${item.label}: ₹ ${val.toLocaleString('en-IN')} (${pct}%)`;
              }
            }
          }
        },
        cutout: "70%"
      }
    });
  },

  renderPerformanceChart(portfolio) {
    const ctx = document.getElementById("performanceChartCanvas");
    if (!ctx) return;
    if (this.performanceChart) this.performanceChart.destroy();

    const funds = [...(portfolio.funds || [])].sort((a, b) => (b.mom_gain_pct || 0) - (a.mom_gain_pct || 0));
    const labels = funds.map(f => f.name.length > 25 ? f.name.substring(0, 23) + "..." : f.name);
    const gains = funds.map(f => f.mom_gain_pct || 0);

    const colors = gains.map(g => g >= 4.0 ? "rgba(16, 185, 129, 0.85)" : (g >= 2.0 ? "rgba(6, 182, 212, 0.85)" : "rgba(139, 92, 246, 0.85)"));

    this.performanceChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Month-over-Month Gain (%)",
            data: gains,
            backgroundColor: colors,
            borderRadius: 6,
            borderWidth: 0
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) => `MoM Gain: +${item.raw.toFixed(2)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8", callback: (v) => `+${v}%` }
          },
          y: {
            grid: { display: false },
            ticks: { color: "#e2e8f0", font: { size: 11 } }
          }
        }
      }
    });
  },

  renderBenchmarkChart(portfolio) {
    const ctx = document.getElementById("benchmarkChartCanvas");
    if (!ctx) return;
    if (this.benchmarkChart) this.benchmarkChart.destroy();

    const history = portfolio.monthly_history || [];
    const labels = history.map(h => h.month);
    const portfolioMoM = history.map(h => h.mom_change_pct || 3.0);
    const niftyMoM = history.map(h => h.nifty50_return || 1.4);

    this.benchmarkChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Your Portfolio MoM (%)",
            data: portfolioMoM,
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            tension: 0.3,
            borderWidth: 2.5,
            pointRadius: 4
          },
          {
            label: "Nifty 50 MoM (%)",
            data: niftyMoM,
            borderColor: "#94a3b8",
            borderDash: [4, 4],
            tension: 0.3,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "top",
            labels: { color: "#94a3b8", font: { size: 11 } }
          },
          tooltip: {
            callbacks: {
              label: (item) => `${item.dataset.label}: +${item.raw.toFixed(2)}%`
            }
          }
        },
        scales: {
          x: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8" }
          },
          y: {
            grid: { color: "rgba(255, 255, 255, 0.05)" },
            ticks: { color: "#94a3b8", callback: (v) => `+${v}%` }
          }
        }
      }
    });
  }
};
