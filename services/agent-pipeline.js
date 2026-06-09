'use strict';

// ── CircuitBreaker ────────────────────────────────────────────────────────────
class CircuitBreaker {
  constructor(maxCalls = 5, cooldownMs = 60000) {
    this.maxCalls   = maxCalls;
    this.cooldownMs = cooldownMs;
    this._calls     = {}; // agentId -> [timestamp, ...]
  }

  validate(agentId) {
    const now  = Date.now();
    const list = (this._calls[agentId] || []).filter(t => now - t < this.cooldownMs);
    this._calls[agentId] = list;
    if (list.length >= this.maxCalls) return false;
    this._calls[agentId].push(now);
    return true;
  }
}

// ── TelemetryLogger ───────────────────────────────────────────────────────────
class TelemetryLogger {
  log(agentId, { promptTokens = 0, completionTokens = 0, latencyMs = 0 } = {}) {
    console.log(JSON.stringify({
      level:            'info',
      ts:               new Date().toISOString(),
      source:           'agent-pipeline',
      agentId,
      promptTokens,
      completionTokens,
      totalTokens:      promptTokens + completionTokens,
      latencyMs,
    }));
  }
}

// ── DataSanitizer ─────────────────────────────────────────────────────────────
class DataSanitizer {
  static parseJson(raw) {
    if (typeof raw !== 'string') return { status: 'MALFORMED_DATA', error: 'input is not a string' };
    // Strip markdown code fences
    let cleaned = raw.trim();
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    try {
      const payload = JSON.parse(cleaned);
      return { status: 'ok', payload };
    } catch (e) {
      return { status: 'MALFORMED_DATA', error: e.message };
    }
  }
}

// ── TradeSignalValidator ──────────────────────────────────────────────────────
class TradeSignalValidator {
  static validate(signal) {
    const errors = [];
    if (!signal || typeof signal !== 'object') {
      return { valid: false, errors: ['signal must be an object'] };
    }
    // ticker: 1-5 uppercase letters
    if (typeof signal.ticker !== 'string' || !/^[A-Z]{1,5}$/.test(signal.ticker)) {
      errors.push('ticker must be 1-5 uppercase letters');
    }
    // action
    if (!['BUY', 'HOLD', 'SELL'].includes(signal.action)) {
      errors.push('action must be BUY, HOLD, or SELL');
    }
    // entryRange: array of exactly 2 numbers
    if (!Array.isArray(signal.entryRange) || signal.entryRange.length !== 2 ||
        typeof signal.entryRange[0] !== 'number' || typeof signal.entryRange[1] !== 'number') {
      errors.push('entryRange must be an array of 2 numbers');
    }
    // stopLoss: number > 0
    if (typeof signal.stopLoss !== 'number' || signal.stopLoss <= 0) {
      errors.push('stopLoss must be a number > 0');
    }
    // confidenceScore: 0-1
    if (typeof signal.confidenceScore !== 'number' || signal.confidenceScore < 0 || signal.confidenceScore > 1) {
      errors.push('confidenceScore must be a number between 0 and 1');
    }
    return { valid: errors.length === 0, errors };
  }
}

module.exports = { CircuitBreaker, TelemetryLogger, DataSanitizer, TradeSignalValidator };
