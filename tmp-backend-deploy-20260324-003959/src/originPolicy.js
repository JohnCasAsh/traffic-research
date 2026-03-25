const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173'];

function normalizeOriginLikeValue(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function parseOriginPatterns(rawValue, fallback = DEFAULT_ALLOWED_ORIGINS) {
  const sourceValues = typeof rawValue === 'string' && rawValue.trim()
    ? rawValue.split(',')
    : fallback;

  return Array.from(new Set(
    sourceValues
      .map((value) => normalizeOriginLikeValue(value))
      .filter(Boolean)
  ));
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileOriginPattern(pattern) {
  if (!pattern.includes('*')) {
    return null;
  }

  return new RegExp(`^${escapeRegex(pattern).replace(/\\\*/g, '[^/]+')}$`);
}

function createOriginPolicy(rawValue, fallback = DEFAULT_ALLOWED_ORIGINS) {
  const patterns = parseOriginPatterns(rawValue, fallback);
  const matchers = patterns.map((pattern) => {
    const regex = compileOriginPattern(pattern);

    if (!regex) {
      return (origin) => origin === pattern;
    }

    return (origin) => regex.test(origin);
  });

  return {
    patterns,
    isAllowed(origin) {
      const normalizedOrigin = normalizeOriginLikeValue(origin);
      if (!normalizedOrigin) {
        return false;
      }

      return matchers.some((matcher) => matcher(normalizedOrigin));
    },
    resolveFrontendBaseUrl(candidates, fallbackUrl) {
      for (const candidate of candidates) {
        const normalizedCandidate = normalizeOriginLikeValue(candidate);
        if (normalizedCandidate && matchers.some((matcher) => matcher(normalizedCandidate))) {
          return normalizedCandidate;
        }
      }

      return normalizeOriginLikeValue(fallbackUrl);
    },
  };
}

module.exports = {
  createOriginPolicy,
  normalizeOriginLikeValue,
};
