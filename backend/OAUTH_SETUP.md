# Social OAuth setup

Campaign.AI now uses OAuth authorization rather than asking users to paste access tokens into the frontend. Tokens are encrypted with Fernet and remain in the backend database.

## 1. Configure the backend

From `backend/`:

```bash
pip install -r requirements.txt
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy `.env.example` to `.env`, then set:

- `BACKEND_URL`: public backend origin (local: `http://localhost:8000`)
- `FRONTEND_URL`: frontend origin (local: `http://localhost:5173`)
- `SOCIAL_TOKEN_ENCRYPTION_KEY`: the generated Fernet key. Keep it secret and back it up securely. If it changes or is lost, existing stored tokens cannot be decrypted.
- OAuth client IDs/secrets for the providers you want to enable.

Never commit `.env`, OAuth secrets, or the encryption key. Configure production values as deployment secrets, and use HTTPS origins in production.

## 2. Provider apps and callback URLs

Register the exact callback URLs shown by `GET /oauth/config` in each provider developer console:

| Provider | Callback URL | Required scopes / access |
|---|---|---|
| Meta (Facebook + Instagram) | `{BACKEND_URL}/oauth/meta/callback` | `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish` |
| LinkedIn | `{BACKEND_URL}/oauth/linkedin/callback` | `openid`, `profile`, `w_member_social` |
| X | `{BACKEND_URL}/oauth/twitter/callback` | `tweet.read`, `tweet.write`, `users.read`, `offline.access` |

- **Meta:** Create a Meta app with Facebook Login and the required Page/Instagram products and permissions. The user must manage a Facebook Page. Instagram publishing requires an Instagram Professional account linked to that Page. Provider app review / Advanced Access may be needed for accounts outside app roles.
- **LinkedIn:** Enable Sign In with LinkedIn using OpenID Connect and the Community Management API product / member social posting access. This implementation publishes text posts to the authorized member profile. Organization posting needs additional organization permissions and role checks.
- **X:** Configure OAuth 2.0 Authorization Code with PKCE and a confidential client. Use the callback above and enable user-context write access. App-only bearer tokens cannot create posts.

The app checks client ID, client secret, and token encryption configuration before starting authorization.

## 3. Connect and publish

1. Start the backend: `uvicorn app.main:app --reload --port 8000`.
2. Start the frontend: `npm run dev` from `frontend/`.
3. Open **Social Accounts**, choose Connect for each platform, and approve the provider consent screen.
4. Review and approve campaign content in the campaign workspace.
5. For Instagram, supply a publicly fetchable HTTPS image URL. Meta's servers must be able to download the image without a login. Text-only Instagram feed publishing is not supported by this implementation.
6. Choose a connected account if multiple accounts exist for a platform, then select **Publish approved now**.

Publishing results include per-platform success/failure, the platform post ID, and a link when the provider returns one. A failed post remains approved so it can be retried. Scheduled jobs use the same OAuth publisher and record failures instead of simulating success.

## Security and deployment notes

- OAuth state values are random, short-lived (15 minutes), single-use, and persisted server-side. X uses PKCE (S256).
- Access and refresh tokens are encrypted at rest. They are never returned by account-list APIs or exposed to frontend JavaScript.
- Tokens are stored in a separate SQLite database at `backend/app/social_oauth.db` by default. Set `SOCIAL_OAUTH_DB` to a persistent writable path in production and back it up with the encryption key.
- This repository currently has no end-user login or tenant isolation. Connected accounts therefore belong to one shared Campaign.AI workspace. Do not expose a shared deployment to multiple unrelated users until OAuth accounts are scoped to authenticated application users and endpoints are protected by app authentication.
- Configure a restrictive `CORS_ORIGINS` allowlist and a rate limiter before public production use. Provider rate limits, permission review, app mode and account eligibility still apply.
