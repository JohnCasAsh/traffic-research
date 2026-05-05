// ============================================================
// STATISTICAL ANALYSIS MODULE — SmartRoute / Navocs
// ============================================================
// GET /api/stats/analysis  — normality + significance test + effect size + CI
// GET /api/stats/export-csv — downloadable per-trip CSV
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const TRIP_REPORTS_FILE = process.env.TRIP_REPORTS_FILE || './data/trip-reports.json';

function resolveTripReportsPath() {
  if (path.isAbsolute(TRIP_REPORTS_FILE)) return TRIP_REPORTS_FILE;
  return path.join(__dirname, '..', TRIP_REPORTS_FILE);
}

function readTripReports() {
  try {
    const filePath = resolveTripReportsPath();
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Extract { baseline, navocs } from a trip record.
// Supports explicit baselineCost/navocsCost fields AND SpeedMeter format fallback.
function extractCosts(trip) {
  if (typeof trip.baselineCost === 'number' && typeof trip.navocsCost === 'number') {
    return { baseline: trip.baselineCost, navocs: trip.navocsCost };
  }
  // SpeedMeter format: predicted.predictedCostPhp = navocs predicted, actual.costPhp = real
  if (trip.predicted?.predictedCostPhp != null && trip.actual?.costPhp != null) {
    return { baseline: trip.predicted.predictedCostPhp, navocs: trip.actual.costPhp };
  }
  return null;
}

// ─── Normal distribution ─────────────────────────────────────────────────────

function erf(x) {
  // Abramowitz & Stegun approximation 7.1.26 (max error < 1.5e-7)
  const sign = x >= 0 ? 1 : -1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function normCDF(x) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// Acklam (2003) rational approximation — inverse normal CDF
function normPPF(p) {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pLow = 0.02425;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  } else if (p <= 1 - pLow) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) / ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
  }
}

// ─── Gamma & Beta functions ───────────────────────────────────────────────────

// Lanczos approximation (g=7)
function logGamma(x) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Regularized incomplete beta I_x(a, b) — Numerical Recipes Lentz CF method
function betaCF(a, b, x) {
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  const FPMIN = 1e-30;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return h;
}

function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const bt = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - logBeta);
  if (x < (a + 1) / (a + b + 2)) return bt * betaCF(a, b, x) / a;
  return 1 - bt * betaCF(b, a, 1 - x) / b;
}

// Two-tailed p-value for t-distribution with df degrees of freedom
function tTwoTailedP(t, df) {
  const x = df / (df + t * t);
  return incompleteBeta(x, df / 2, 0.5);
}

// t critical value via binary search (alpha = one-tail, e.g. 0.025 for 95% CI)
function tCritical(alpha, df) {
  const target = 2 * alpha;
  let lo = 0, hi = 20;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (tTwoTailedP(mid, df) > target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ─── Shapiro-Wilk test (Royston 1982/1992) ──────────────────────────────────

function shapiroWilk(data) {
  const n = data.length;
  if (n < 3) return { W: null, p: null };
  const sorted = [...data].sort((a, b) => a - b);
  const mean = sorted.reduce((s, x) => s + x, 0) / n;
  const ss = sorted.reduce((s, x) => s + (x - mean) ** 2, 0);
  if (ss === 0) return { W: 1, p: 1 };

  // Blom (1958) normal score approximation for a-coefficients
  const mi = Array.from({ length: n }, (_, i) => normPPF((i + 1 - 3 / 8) / (n + 0.25)));
  const mNorm = Math.sqrt(mi.reduce((s, x) => s + x * x, 0));

  const half = Math.floor(n / 2);
  let b = 0;
  for (let i = 0; i < half; i++) {
    b += (mi[n - 1 - i] / mNorm) * (sorted[n - 1 - i] - sorted[i]);
  }

  const W = Math.min(1, Math.max(0, (b * b) / ss));

  // P-value — Royston (1992) normal approximation
  const y = Math.log(1 - W);
  const u = Math.log(n);
  let mu, sigma;
  if (n >= 12) {
    mu = 0.0038915 * u ** 3 - 0.083751 * u * u - 0.31082 * u - 1.5861;
    sigma = Math.exp(0.0030302 * u * u - 0.082676 * u - 0.4803);
  } else {
    mu = -0.0006714 * n ** 3 + 0.025054 * n * n - 0.6714 * n + 0.7240;
    sigma = Math.exp(-0.0020322 * n ** 3 + 0.04981 * n * n - 0.19814 * n - 0.1744);
  }
  const z = (y - mu) / sigma;
  const p = Math.max(0, Math.min(1, 1 - normCDF(z)));

  return { W: r4(W), p: r4(p) };
}

// ─── Paired t-test ─────────────────────────────────────────────────────────

function pairedTTest(diffs) {
  const n = diffs.length;
  const mean = diffs.reduce((s, x) => s + x, 0) / n;
  const variance = diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  const t = mean / Math.sqrt(variance / n);
  const p = Math.max(0, tTwoTailedP(Math.abs(t), n - 1));
  return { statistic: r4(t), p: r4(p) };
}

// ─── Cohen's d ────────────────────────────────────────────────────────────────

function cohensD(diffs) {
  const n = diffs.length;
  const mean = diffs.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  const d = Math.abs(mean / sd);
  const magnitude = d >= 0.8 ? 'Large' : d >= 0.5 ? 'Medium' : 'Small';
  return { value: r4(d), magnitude };
}

// ─── Wilcoxon signed-rank test ─────────────────────────────────────────────

function wilcoxonSignedRank(diffs) {
  const nonZero = diffs.filter(d => d !== 0);
  const n = nonZero.length;
  if (n === 0) return { statistic: 0, p: 1 };

  const items = nonZero.map(d => ({ d, abs: Math.abs(d) })).sort((a, b) => a.abs - b.abs);
  let k = 0;
  const ranks = new Array(n);
  while (k < n) {
    let j = k;
    while (j < n && items[j].abs === items[k].abs) j++;
    const avg = (k + j + 1) / 2;
    for (let m = k; m < j; m++) ranks[m] = avg;
    k = j;
  }

  let Wplus = 0;
  for (let m = 0; m < n; m++) if (items[m].d > 0) Wplus += ranks[m];

  const mu = n * (n + 1) / 4;
  const sigma = Math.sqrt(n * (n + 1) * (2 * n + 1) / 24);
  const z = (Wplus - mu) / sigma;
  const p = Math.max(0, Math.min(1, 2 * normCDF(-Math.abs(z))));

  return { statistic: r4(Wplus), p: r4(p) };
}

// ─── Rank-biserial correlation ───────────────────────────────────────────────

function rankBiserial(diffs) {
  const nonZero = diffs.filter(d => d !== 0);
  const n = nonZero.length;
  if (n === 0) return { value: 0, magnitude: 'Small' };

  const items = nonZero.map(d => ({ d, abs: Math.abs(d) })).sort((a, b) => a.abs - b.abs);
  let k = 0;
  const ranks = new Array(n);
  while (k < n) {
    let j = k;
    while (j < n && items[j].abs === items[k].abs) j++;
    const avg = (k + j + 1) / 2;
    for (let m = k; m < j; m++) ranks[m] = avg;
    k = j;
  }

  let Wp = 0, Wn = 0;
  for (let m = 0; m < n; m++) {
    if (items[m].d > 0) Wp += ranks[m];
    else Wn += ranks[m];
  }

  const r = Math.abs((Wp - Wn) / (n * (n + 1) / 2));
  const magnitude = r >= 0.5 ? 'Large' : r >= 0.3 ? 'Medium' : 'Small';
  return { value: r4(r), magnitude };
}

// ─── 95% Confidence Interval ─────────────────────────────────────────────────

function ci95(diffs) {
  const n = diffs.length;
  const mean = diffs.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(diffs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  const se = sd / Math.sqrt(n);
  const tc = tCritical(0.025, n - 1);
  return { low: r2(mean - tc * se), high: r2(mean + tc * se) };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function r2(x) { return Math.round(x * 100) / 100; }
function r4(x) { return Math.round(x * 10000) / 10000; }

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/analysis', (req, res) => {
  const all = readTripReports();
  const pairs = all.reduce((acc, trip) => {
    const costs = extractCosts(trip);
    if (costs && costs.baseline > 0 && costs.navocs >= 0) {
      acc.push({ trip, baseline: costs.baseline, navocs: costs.navocs });
    }
    return acc;
  }, []);

  const n = pairs.length;
  if (n < 3) {
    return res.json({
      n,
      message: n === 0 ? 'No trip data with cost comparisons yet.' : 'Minimum 3 trips required for statistical analysis.',
    });
  }

  const diffs = pairs.map(p => p.baseline - p.navocs);
  const meanBaseline = r2(pairs.reduce((s, p) => s + p.baseline, 0) / n);
  const meanNavocs = r2(pairs.reduce((s, p) => s + p.navocs, 0) / n);
  const meanSavings = r2(diffs.reduce((s, x) => s + x, 0) / n);
  const meanSavingsPct = r2(meanBaseline > 0 ? (meanSavings / meanBaseline) * 100 : 0);

  const normality = shapiroWilk(diffs);
  const isNormal = normality.p !== null && normality.p >= 0.05;

  let test, effectSize;
  if (isNormal) {
    const tt = pairedTTest(diffs);
    test = {
      name: 'Paired-samples t-test',
      statistic: tt.statistic,
      p: tt.p,
      significant: tt.p < 0.05,
    };
    const cd = cohensD(diffs);
    effectSize = { name: "Cohen's d", value: cd.value, magnitude: cd.magnitude };
  } else {
    const wx = wilcoxonSignedRank(diffs);
    test = {
      name: 'Wilcoxon signed-rank test',
      statistic: wx.statistic,
      p: wx.p,
      significant: wx.p < 0.05,
    };
    const rb = rankBiserial(diffs);
    effectSize = { name: 'Rank-biserial correlation', value: rb.value, magnitude: rb.magnitude };
  }

  const ciResult = ci95(diffs);

  return res.json({
    n,
    meanBaseline,
    meanNavocs,
    meanSavings,
    meanSavingsPct,
    normality: { W: normality.W, p: normality.p, isNormal },
    test,
    effectSize,
    ci95: ciResult,
  });
});

router.get('/export-csv', (req, res) => {
  const all = readTripReports();
  const rows = [];

  for (const trip of all) {
    const costs = extractCosts(trip);
    if (!costs || costs.baseline <= 0) continue;
    const savings = r2(costs.baseline - costs.navocs);
    const savingsPct = r2(costs.baseline > 0 ? (savings / costs.baseline) * 100 : 0);
    rows.push([
      trip.id || '',
      (trip.finishedAt || trip.savedAt || '').split('T')[0],
      trip.vehicleType || '',
      costs.baseline,
      costs.navocs,
      savings,
      savingsPct,
    ]);
  }

  const header = 'trip_id,date,vehicle_type,baseline_cost_php,navocs_cost_php,savings_php,savings_pct\n';
  const csv = header + rows.map(r => r.join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="navocs-trip-analysis.csv"');
  res.send(csv);
});

module.exports = { statsRouter: router };
