# Frontend security baseline

The UI follows the OWASP Top 10 Client-Side Security Risks as a release requirement.

- Access control is enforced by the API. Role-filtered navigation is only a usability layer, never a permission boundary.
- User-provided values are rendered as text. The app does not use `dangerouslySetInnerHTML`, dynamic script injection, or HTML string templates.
- Access and refresh tokens are held in memory only; they are not written to `localStorage`, `sessionStorage`, cookies, URLs, or analytics payloads.
- Documents are never exposed as public storage objects. The UI requests short-lived, server-authorized upload/download URLs and completes uploads with a SHA-256 digest.
- No third-party fonts, scripts, analytics, or embedded origins are loaded by the app. Keep the dependency lockfile reviewed and run `npm audit` during release checks.
- Sensitive API failures are shown as safe problem text. Avoid logging tokens, document URLs, personal data, or full API responses in client-side logs.
- The production host must send a restrictive CSP, for example:

```text
default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self' https://api.example.com; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; worker-src 'self'; manifest-src 'self';
```

Also configure `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` with unused capabilities disabled, and HTTPS-only transport at CloudFront. Replace `https://api.example.com` with the real API origin; do not use a wildcard in `connect-src`.

The security controls align with the [OWASP Top 10 Client-Side Security Risks](https://owasp.org/www-project-top-10-client-side-security-risks/). They complement, but do not replace, backend authorization, validation, rate limiting, audit logging, and storage ownership checks.
