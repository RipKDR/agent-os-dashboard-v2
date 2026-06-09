/* ── CHAT RELAY ENHANCEMENTS ───────────────────────────────── */

let relayStatus = 'disconnected'; // 'connected' | 'disconnected' | 'connecting'
let _loadHistoryTimer = null;

function initRelayStatus() {
  const ch = document.getElementById('ch-conn');
  if (!ch) return;
  ch.textContent = relayStatus === 'connected' ? 'Relay: Live' : relayStatus === 'connecting' ? 'Relay: Connecting…' : 'Relay: Offline';
  ch.style.color = relayStatus === 'connected' ? 'var(--green)' : relayStatus === 'connecting' ? 'var(--amber)' : 'var(--faint)';
}

// Listen for relay events via SSE (patched into existing SSE handler)
function handleRelayEvent(data) {
  if (data.type === 'relay_connected') {
    relayStatus = 'connected';
    initRelayStatus();
    toast2('Telegram relay connected', 'success');
  } else if (data.type === 'relay_disconnected') {
    relayStatus = 'disconnected';
    initRelayStatus();
  } else if (data.type === 'new_telegram_msg') {
    if (chatAgent === 'telegram_inbox' || chatAgent === data.agent) {
      clearTimeout(_loadHistoryTimer);
      _loadHistoryTimer = setTimeout(() => loadHistory(chatAgent), 300);
    }
    pushNotif('🔔 Telegram message received');
  }
}

// Patch the existing SSE handler to capture relay events.
// Resolved dynamically so load order doesn't matter.
window._handleSSEEvent = (function(orig) {
  return function(type, data) {
    if (type === 'relay-event') handleRelayEvent(data);
    if (orig) orig(type, data);
  };
})(window._handleSSEEvent);


/* ── FEEDBACK BUTTONS ON LOGS ──────────────────────────────── */

function addFeedbackToLogRow(rowEl, logEntry) {
  if (!logEntry || !logEntry.id) return;

  const fbDiv = document.createElement('div');
  fbDiv.className = 'log-feedback';
  fbDiv.style.cssText = 'display:flex;gap:4px;align-items:center;margin-left:8px';

  const makeBtn = (emoji, title, rating, type) => {
    const btn = document.createElement('button');
    btn.className = 'fb-feedback';
    btn.innerHTML = emoji;
    btn.title = title;
    btn.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;padding:2px 4px;opacity:0.5';
    btn.onmouseenter = () => { btn.style.opacity = '1'; };
    btn.onmouseleave = () => { if (!btn._active) btn.style.opacity = '0.5'; };
    btn.onclick = () => submitFeedback(logEntry.id, rating, type, btn);
    return btn;
  };

  fbDiv.appendChild(makeBtn('👍', 'Good result (rating 4-5)',  5, 'task_quality'));
  fbDiv.appendChild(makeBtn('👎', 'Poor result (rating 1-2)',  2, 'task_quality'));
  fbDiv.appendChild(makeBtn('🚩', 'Flag for review',           3, 'code_review'));
  rowEl.appendChild(fbDiv);
}

async function submitFeedback(logId, rating, type, btn) {
  btn.style.opacity = '1';
  btn._active = true;

  const comment = prompt('Optional feedback comment (press OK to skip):');

  const client = window.sb;
  if (!client) { toast2('Supabase not available', 'error'); return; }

  try {
    const { error } = await client
      .from('task_feedback')
      .insert({
        log_id: logId,
        rating,
        comment: comment || null,
        feedback_type: type,
        agent_name: 'operator',
      });

    if (error) throw error;
    toast2('Feedback recorded ✓', 'success');
    btn.closest('.l-row')?.animate([
      { background: 'var(--green)' },
      { background: 'transparent' }
    ], { duration: 800 });
  } catch (e) {
    toast2('Feedback error: ' + e.message, 'error');
  }
}

// Monkey-patch renderLogs to inject feedback buttons
const _origRenderLogs = window.renderLogs;
window.renderLogs = function() {
  _origRenderLogs();
  document.querySelectorAll('.l-row').forEach(row => {
    const logId = row.dataset.logId;
    if (logId && !row.querySelector('.log-feedback')) {
      const entry = allLogs.find(l => String(l.id) === logId);
      if (entry) addFeedbackToLogRow(row, entry);
    }
  });
};


/* ── RELAY CONTROLS IN SETTINGS ─────────────────────────────── */

// SECURITY NOTE: Bot token is stored in localStorage for local-only use.
// Any XSS on this page can exfiltrate it. Do NOT use on shared/public machines.

function renderRelaySettings() {
  const el = document.getElementById('settings-connections');
  if (!el) return;
  el.innerHTML = `
    <div style="font-size:9px;color:var(--dim);margin-bottom:6px">TELEGRAM RELAY</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <label style="font-size:9px;color:var(--dim)">Bot Token
        <input id="relay-tg-token" type="password" placeholder="Paste bot token…"
          style="display:block;width:100%;margin-top:3px;background:var(--raised);border:1px solid var(--border2);border-radius:3px;padding:4px 8px;font:9px var(--mono);color:var(--text);outline:none">
      </label>
      <label style="font-size:9px;color:var(--dim)">Chat ID
        <input id="relay-tg-chat" type="text" placeholder="e.g. -1001234567890"
          style="display:block;width:100%;margin-top:3px;background:var(--raised);border:1px solid var(--border2);border-radius:3px;padding:4px 8px;font:9px var(--mono);color:var(--text);outline:none">
      </label>
    </div>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <button class="dispatch-btn" onclick="saveRelaySettings()" style="font-size:8px;padding:4px 10px;background:var(--amber);color:#000">Save & Connect</button>
      <span id="relay-status-badge" style="font-size:8px;padding:2px 8px;border-radius:2px;background:var(--raised);color:var(--dim)">● Offline</span>
    </div>
    <div style="font-size:8px;color:var(--dim)">Relay worker must be running (see telegram-relay/worker.py). Dashboard auto-restarts SSE on connection.</div>
  `;
}

function saveRelaySettings() {
  const token = document.getElementById('relay-tg-token')?.value?.trim();
  const chatId = document.getElementById('relay-tg-chat')?.value?.trim();

  if (!token || !chatId) {
    toast2('Token and Chat ID are required', 'warn');
    return;
  }

  localStorage.setItem('relay_tg_token', token);
  localStorage.setItem('relay_tg_chat', chatId);

  const badge = document.getElementById('relay-status-badge');
  if (badge) { badge.textContent = '● Connecting…'; badge.style.color = 'var(--amber)'; }

  fetch('/api/relay/reconnect', { method: 'POST' })
    .then(r => r.json())
    .then(() => {
      if (badge) { badge.textContent = '● Connected'; badge.style.color = 'var(--green)'; }
      toast2('Relay reconnecting…', 'success');
    })
    .catch(e => {
      if (badge) { badge.textContent = '● Offline'; badge.style.color = 'var(--red)'; }
      toast2('Reconnect failed: ' + e.message, 'error');
    });
}

// Auto-load relay settings on settings tab
const _origRenderSettings = window.renderSettings;
window.renderSettings = function() {
  _origRenderSettings();
  renderRelaySettings();
};
