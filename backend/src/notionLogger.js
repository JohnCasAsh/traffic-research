// ============================================
// NOTION LOGGER - Automatic project activity log
// ============================================
// Sends every backend event to a Notion database as a new row.
// This creates a permanent, searchable research log automatically.
//
// Setup:
//   1. Go to https://www.notion.so/my-integrations → New Integration
//   2. Copy the Internal Integration Token → NOTION_API_KEY in .env
//   3. Create a Notion database with columns defined in REQUIRED_PROPERTIES below
//   4. Open that database → click Share → invite your integration
//   5. Copy the database ID from the URL → NOTION_DATABASE_ID in .env
//
// Database URL format:
//   https://www.notion.so/YOUR_WORKSPACE/{DATABASE_ID}?v=...
//                                         ^^^^^^^^^^^^ copy this (32 chars, no dashes)
//
// Required database columns:
//   Name         → Title
//   Date         → Date
//   Event Type   → Select
//   Severity     → Select
//   Environment  → Select
//   Service      → Text
//   Message      → Text
//   Details      → Text
// ============================================

const NOTION_API_VERSION = '2022-06-28';
const NOTION_PAGES_URL = 'https://api.notion.com/v1/pages';

function isNotionConfigured() {
  return Boolean(process.env.NOTION_API_KEY) && Boolean(process.env.NOTION_DATABASE_ID);
}

function inferSeverity(eventType) {
  if (!eventType) return 'info';
  const t = eventType.toLowerCase();
  if (t.includes('exception') || t.includes('crash') || t.includes('fatal')) return 'critical';
  if (t.includes('error') || t.includes('failure') || t.includes('reject')) return 'error';
  if (t.includes('locked') || t.includes('lockout') || t.includes('warn')) return 'warning';
  return 'info';
}

function buildTitle(eventType, payload) {
  const label = eventType
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (payload && payload.message) {
    const snippet = String(payload.message).slice(0, 60);
    return `${label} — ${snippet}`;
  }
  return label;
}

function buildDetailsText(payload) {
  if (!payload || Object.keys(payload).length === 0) return '';
  try {
    return JSON.stringify(payload, null, 2).slice(0, 1900); // Notion text limit
  } catch {
    return String(payload);
  }
}

async function logToNotion(eventType, payload = {}, options = {}) {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID;

  if (!apiKey || !databaseId) {
    return { logged: false, skipped: true, reason: 'NOTION_API_KEY or NOTION_DATABASE_ID not set' };
  }

  const service = options.service || process.env.npm_package_name || 'traffic-management-backend';
  const environment = process.env.NODE_ENV || 'development';
  const severity = options.severity || inferSeverity(eventType);
  const now = new Date().toISOString();

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [{ text: { content: buildTitle(eventType, payload) } }],
      },
      Date: {
        date: { start: now },
      },
      'Event Type': {
        select: { name: eventType },
      },
      Severity: {
        select: { name: severity },
      },
      Environment: {
        select: { name: environment },
      },
      Service: {
        rich_text: [{ text: { content: service } }],
      },
      Message: {
        rich_text: [{ text: { content: String(payload.message || eventType).slice(0, 2000) } }],
      },
      Details: {
        rich_text: [{ text: { content: buildDetailsText(payload) } }],
      },
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(NOTION_PAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { logged: false, status: response.status, error: errorText };
    }

    const result = await response.json();
    return { logged: true, pageId: result.id };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'Notion request timed out' : (err.message || String(err));
    return { logged: false, error: message };
  }
}

// Fire-and-forget helper — never throws, never blocks the caller
function logToNotionAsync(eventType, payload = {}, options = {}) {
  if (!isNotionConfigured()) return;
  logToNotion(eventType, payload, options).catch(() => {
    // Silently swallow — alerting must never crash the app
  });
}

// ============================================
// DAILY PROGRESS REPORT
// ============================================
async function logProgress(entry = {}) {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_PROGRESS_DB_ID;

  if (!apiKey || !databaseId) {
    return { logged: false, skipped: true, reason: 'NOTION_PROGRESS_DB_ID not set' };
  }

  const now = new Date().toISOString();
  const title = entry.title || 'Progress update';

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [{ text: { content: title.slice(0, 200) } }],
      },
      Date: {
        date: { start: entry.date || now },
      },
      Category: {
        select: { name: entry.category || 'Backend' },
      },
      Status: {
        select: { name: entry.status || 'Completed' },
      },
      Notes: {
        rich_text: [{ text: { content: String(entry.notes || '').slice(0, 2000) } }],
      },
      Impact: {
        select: { name: entry.impact || 'Medium' },
      },
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(NOTION_PAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { logged: false, status: response.status, error: errorText };
    }

    const result = await response.json();
    return { logged: true, pageId: result.id };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'Notion request timed out' : (err.message || String(err));
    return { logged: false, error: message };
  }
}

// ============================================
// SYSTEM HEALTH SUMMARY
// ============================================
async function logHealthSummary(summary = {}) {
  const apiKey = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_HEALTH_DB_ID;

  if (!apiKey || !databaseId) {
    return { logged: false, skipped: true, reason: 'NOTION_HEALTH_DB_ID not set' };
  }

  const now = new Date().toISOString();
  const dateLabel = new Date().toISOString().split('T')[0];

  const body = {
    parent: { database_id: databaseId },
    properties: {
      Name: {
        title: [{ text: { content: `Health Summary — ${dateLabel}` } }],
      },
      Date: {
        date: { start: now },
      },
      'Total Events': {
        number: typeof summary.totalEvents === 'number' ? summary.totalEvents : 0,
      },
      Errors: {
        number: typeof summary.errors === 'number' ? summary.errors : 0,
      },
      Warnings: {
        number: typeof summary.warnings === 'number' ? summary.warnings : 0,
      },
      'Uptime Status': {
        select: { name: summary.uptimeStatus || 'Healthy' },
      },
      'Key Events': {
        rich_text: [{ text: { content: String(summary.keyEvents || 'No notable events').slice(0, 2000) } }],
      },
      Notes: {
        rich_text: [{ text: { content: String(summary.notes || '').slice(0, 2000) } }],
      },
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(NOTION_PAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_API_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      return { logged: false, status: response.status, error: errorText };
    }

    const result = await response.json();
    return { logged: true, pageId: result.id };
  } catch (err) {
    const message = err.name === 'AbortError' ? 'Notion request timed out' : (err.message || String(err));
    return { logged: false, error: message };
  }
}

module.exports = { logToNotion, logToNotionAsync, isNotionConfigured, logProgress, logHealthSummary };
