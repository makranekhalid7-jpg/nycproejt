# Stripe Configuration & Key Swap Guide

NYC Model Club reads all Stripe credentials exclusively from environment variables (`process.env`). Never hardcode live Stripe keys in source files.

## Modes Supported

1. **Test-Mode Fallback (Default when `STRIPE_SECRET_KEY` is unset)**
   - Membership (`$29` / `$59` / `$99`), Model Bookings, Media & Visual Works Bookings, and `/onboarding` work immediately without throwing `STRIPE_SECRET_KEY` missing errors.
   - To disable fallback in strict production once keys are installed, set `STRIPE_TEST_MODE="false"`.

2. **Stripe Test Mode (`sk_test_...`)**
   - Uses Stripe's official hosted Checkout (`checkout.stripe.com`) in test mode.
   - Test cards (`4242 4242 4242 4242`) can be used on Stripe Checkout.

3. **Stripe Live Production (`sk_live_...` + `whsec_...`)**
   - Automatically activates live hosted Checkout and strict `checkout.session.completed` webhook verification (`POST /api/webhook`).
   - Test/fallback session IDs (`cs_dev_*`) and `/api/confirm-membership` are automatically disabled (`403`).

---

## 1. `.env` File (Local or VPS)

\`\`\`env
APP_URL="https://yourdomain.com"
STRIPE_SECRET_KEY="sk_test_your_test_secret_key_here"
STRIPE_PUBLISHABLE_KEY="pk_test_your_test_publishable_key_here"
VITE_STRIPE_PUBLISHABLE_KEY="pk_test_your_test_publishable_key_here"
STRIPE_WEBHOOK_SECRET="whsec_your_webhook_signing_secret_here"
STRIPE_TEST_MODE="true"
\`\`\`

When switching to live production, update `sk_test_...` -> `sk_live_...`, `pk_test_...` -> `pk_live_...`, update `STRIPE_WEBHOOK_SECRET` to your live endpoint's `whsec_...`, set `STRIPE_TEST_MODE="false"`, rebuild (`npm run build`), and restart the server.

---

## 2. PM2 (`ecosystem.config.cjs`)

\`\`\`js
module.exports = {
  apps: [
    {
      name: 'nyc-model-club',
      script: 'server.ts',
      interpreter: 'node',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        APP_URL: 'https://yourdomain.com',
        STRIPE_SECRET_KEY: 'sk_test_your_test_secret_key_here',
        STRIPE_PUBLISHABLE_KEY: 'pk_test_your_test_publishable_key_here',
        STRIPE_WEBHOOK_SECRET: 'whsec_your_webhook_signing_secret_here',
        STRIPE_TEST_MODE: 'true',
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        APP_URL: 'https://yourdomain.com',
        STRIPE_SECRET_KEY: 'sk_live_your_live_secret_key_here',
        STRIPE_PUBLISHABLE_KEY: 'pk_live_your_live_publishable_key_here',
        STRIPE_WEBHOOK_SECRET: 'whsec_your_live_webhook_secret_here',
        STRIPE_TEST_MODE: 'false',
      },
    },
  ],
};
\`\`\`

Restart after updating keys:

\`\`\`bash
pm2 restart nyc-model-club --update-env
\`\`\`

---

## 3. systemd (`/etc/systemd/system/nyc-model-club.service`)

\`\`\`ini
[Service]
WorkingDirectory=/var/www/nyc-model-club
ExecStart=/usr/bin/node server.ts
Restart=always
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=APP_URL=https://yourdomain.com
Environment=STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
Environment=STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key_here
Environment=STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here
Environment=STRIPE_TEST_MODE=true
\`\`\`

Reload and restart after swapping to `sk_live_...`:

\`\`\`bash
sudo systemctl daemon-reload
sudo systemctl restart nyc-model-club
\`\`\`

