// ============================================
// MAKE.COM NOTIFIER - Non-blocking operational alerts
// ============================================

function toPositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error) {
  if (!error) {
    return 'Unknown error';
  }

  if (error.name === 'AbortError') {
    return 'Request timed out';
  }

  return error.message || String(error);
}

function isMakeConfigured() {
  return process.env.MAKE_ENABLED === 'true' && Boolean(process.env.MAKE_WEBHOOK_URL);
}

async function deliverEvent(webhookUrl, event, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Make webhook responded with HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function sendMakeEvent(eventType, payload = {}, options = {}) {
  const webhookUrl = process.env.MAKE_WEBHOOK_URL;
  const enabled = process.env.MAKE_ENABLED === 'true';

  if (!enabled || !webhookUrl) {
    return {
      delivered: false,
      skipped: true,
      reason: 'MAKE integration is disabled or missing MAKE_WEBHOOK_URL',
    };
  }

  const timeoutMs = toPositiveInt(process.env.MAKE_TIMEOUT_MS, 5000);
  const retryAttempts = toPositiveInt(process.env.MAKE_RETRY_ATTEMPTS, 3);
  const retryDelayMs = toPositiveInt(process.env.MAKE_RETRY_DELAY_MS, 750);

  const event = {
    eventType,
    service: 'traffic-management-backend',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    payload,
  };

  const execute = async () => {
    let lastError = null;

    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        await deliverEvent(webhookUrl, event, timeoutMs);
        return { delivered: true, attempts: attempt };
      } catch (error) {
        lastError = error;
        if (attempt < retryAttempts) {
          await sleep(retryDelayMs * attempt);
        }
      }
    }

    throw new Error(normalizeError(lastError));
  };

  if (options.awaitDelivery) {
    return execute();
  }

  execute().catch((error) => {
    console.error('MAKE notification failed:', normalizeError(error));
  });

  return { delivered: false, queued: true };
}

module.exports = {
  sendMakeEvent,
  isMakeConfigured,
};
