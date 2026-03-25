const { setTimeout: sleep } = require('timers/promises');
const { sendMakeEvent } = require('./makeNotifier');

function toPositiveInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
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

async function fetchWithRetry(url, options = {}, config = {}) {
  const retryStatuses = new Set(config.retryStatuses || [408, 429, 500, 502, 503, 504]);
  const maxAttempts = toPositiveInt(config.maxAttempts, toPositiveInt(process.env.API_RETRY_ATTEMPTS, 3));
  const baseDelayMs = toPositiveInt(config.baseDelayMs, toPositiveInt(process.env.API_RETRY_BASE_DELAY_MS, 600));
  const timeoutMs = toPositiveInt(config.timeoutMs, toPositiveInt(process.env.API_TIMEOUT_MS, 10000));
  const requestName = config.requestName || 'external_api_call';

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok && retryStatuses.has(response.status) && attempt < maxAttempts) {
        lastError = new Error(`HTTP ${response.status}`);
        await sleep(baseDelayMs * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(baseDelayMs * attempt);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  await sendMakeEvent('external_api_failure', {
    requestName,
    url,
    maxAttempts,
    error: normalizeError(lastError),
  });

  throw lastError;
}

module.exports = {
  fetchWithRetry,
};
