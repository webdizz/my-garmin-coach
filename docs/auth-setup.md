# Auth setup

The app uses passkey-only login (Face ID, Touch ID or a device key) from GC-7. `src/proxy.ts` gates every route. There is no password login and no sign-up.

Garmin API key and app login are separate. `GARMIN_CONNECT_API_KEY` is only used server-side to pull Garmin data. It never logs you in.

## Setup

1. **Set the secret.** Add these to `.env`. Do not commit the file.

   ```
   BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>   # 32+ chars, required
   APP_ORIGIN=http://localhost:3344                           # must match the exact origin you open, including the port
   ```

   `APP_ORIGIN` defaults to `http://localhost:3344`. Set it explicitly when you use another hostname or an HTTPS URL.

2. **Run migrations** if you haven't yet: `npm run db:migrate`. Migration `0001` creates the auth tables (`user`, `session`, `account`, `passkey`, `verification`).

3. **Start the app:** `npm run dev` (pinned to port 3344).

4. **Mint an enrollment link** on the host: `npm run auth:enroll`. It prints a one-time link that expires in 15 minutes.

5. **Open the link** on the browser or phone you'll use, then approve Face ID, Touch ID or the device key. This registers the passkey.

6. **Log in** at `/login` with that passkey.
   - The session lasts 5 minutes of inactivity and slides forward while you're active.
   - "Lock now" ends the session immediately.

## Notes

- **Hostname binding.** A passkey is bound to the hostname (RP ID). A passkey enrolled on `localhost` won't work on a LAN IP or a domain. To move to a new host, set `APP_ORIGIN` to it and re-enroll.
- **Port.** `APP_ORIGIN` must include the port you actually serve on. The origin check compares the full origin.
- **iPhone.** Passkeys need HTTPS, except on `localhost`. To use the app on your phone, serve it over HTTPS (for example through a Tailscale or Cloudflare tunnel), set `APP_ORIGIN` to that URL, then enroll from the phone.
- **Adding or recovering a device.** Run `npm run auth:enroll` again. Registration has no other entry point.
- **Enrollment tokens.** Tokens are single use and stored only as SHA-256 hashes. The link carries the token in the URL fragment (`/enroll#token`), which the browser does not send in HTTP requests. The enroll page then passes it to the passkey client, which sends it as a `context` query parameter to `/api/auth/passkey/generate-register-options`. So the token does reach the server, in a query string. Keep query strings out of access logs, and if you add a reverse proxy, exclude them there too.
- **Rate limit.** Passkey endpoints allow 20 requests per 60 s per client. Behind a reverse proxy, configure `advanced.ipAddress`, or all clients share one bucket.
- **Route handlers.** `proxy.ts` fails closed, but route handlers must also call `requireSession(request)` (see `/api/sync`).

## Not covered

- This guide was written from the code and tests. A real Face ID enrollment and login on a device has not been run as part of writing it.
