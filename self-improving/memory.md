# Dashboard Self-Improving Memory

## Architecture Lessons

### Single-file constraint
- All backend logic goes in `server.js`, all frontend in `index.html`
- When adding an API endpoint, wire the frontend in the same task
- Don't split into multiple files — the dashboard is served as a single Node.js process

### Duplicate handler blocks
- When patching server.js, always check for existing handlers before adding new ones
- The original server had handlers in two places: early (no auth) and late (auth-gated)
- Always remove old duplicates when adding auth-gated versions
- Use `grep -n '/api/endpoint' server.js` to find all handler locations

### HTML structure
- When adding sections to a panel, verify they're INSIDE the panel div, not floating between panels
- Use `awk '/panel-now/,/panel-knowledge/' index.html` to verify structure
- Extra `</div>` artifacts from patching can break layout — always verify closing tags

### Parallel fetches
- `loadNowSurface()` uses `Promise.allSettled()` for all API fetches
- When adding new fetches, add to both the destructuring array AND the Promise.allSettled array
- Keep the destructuring order matching the fetch order

### Auth pattern
- New endpoints use `if (!requireAuth(req, res)) return;` at the top
- SSE endpoint (`/api/events`) is exempt from auth (it's a streaming endpoint)
- Test with `curl -H "Authorization: Basic $(echo -n 'admin:PASS' | base64)"`

## Debugging Lessons

### Syntax checking
- `node --check server.js` catches syntax errors fast
- `new Function()` JS check doesn't work for scripts with DOM globals — false positives
- For HTML, use `awk` to count opening/closing tags and verify balance

### Common pitfalls
- Orphaned `try {` blocks after partial patch removal
- Mismatched array destructuring (12 fetches but 11 variables)
- Heatmap time window mismatch (label says 7 days, data is 24 hours)
