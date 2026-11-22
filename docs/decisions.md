# Decision log

Format: **Decision** / **Why** / **Status**.

## D1. Web (PWA) over native iOS for now
- **Why:** native SwiftUI needs a paid Apple developer account ($99/yr), and free sideloaded builds expire
  after 7 days. A PWA on iOS 16.4+ covers the need as a home-screen app. Data comes from Garmin, not
  the phone, so HealthKit is not required.
- **Status:** accepted. Capacitor wrap remains an option later.

## D2. Next.js (TypeScript) as the app framework
- **Why:** UI and API routes in one project, mature ecosystem, good PWA story. User asked about it
  directly and it fits.
- **Status:** accepted, pending scaffold.

## D3. Garmin Personal API over unofficial login libraries
- **Why:** official, pull-only, personal key, no username/password in the app. Covers sleep, HRV, weight,
  activities and FIT files according to the Swagger page.
- **Risk:** actual schemas, rate limits and history depth are not yet verified.
- **Fallback:** `python-garminconnect` / `garth` (unofficial, login-based) if the Personal API is missing
  a needed metric.
- **Status:** accepted, verification pending.

## D4. Agent layer: open
Candidates under evaluation:
- **Vercel AI SDK:** mature, provider-agnostic, but the user finds its API custom rather than standard.
- **`@earendil-works/pi-agent-core` + `pi-ai`:** embeddable agent runtime with tool execution and event
  streaming. Built on a unified multi-provider LLM layer. Less common in web apps; check maturity.
- **`@anthropic-ai/claude-agent-sdk`:** Anthropic's agent SDK. Tied to Claude.
- **Standard protocols** the user prefers: A2A (agent-to-agent), AG-UI (agent-to-UI event streams),
  A2UI (declarative agent-generated UI).
- **Status:** open. Decide after a small spike: one tool (`get_metrics`) wired to real data.

## D5. A2UI as candidate for rich agent UI
- **Why:** declarative JSON-schema UI from agents, no arbitrary code execution, has a React renderer.
- **Caveats:** `@a2ui/react` latest is `0.15.0`, which is pre-1.0 even though the spec page is labelled v1.0.
  Expect breaking changes. Renderer maturity must be checked.
- **Status:** candidate, deferred. Revisit once key capabilities (charts, sync, basic chat) exist.

## D6. Build key capabilities before UI design
- **Why:** user preference. Start with data sync, storage and a few metric tools; then design the UI.
- **Status:** accepted.

## Open questions

1. Which agent layer? (D4)
2. Hosting: home machine + Tailscale, or managed platform?
3. Charting library: ECharts, Recharts or uPlot?
4. Is the Personal API sufficient for body composition and FIT parsing?
5. Which LLM provider(s), and what data-sharing policy is acceptable for health data?
