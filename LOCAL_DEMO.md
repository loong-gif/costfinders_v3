# Local consumer demo

The demo covers the consumer discovery flow: homepage, city browsing, treatment
and price filters, deal detail, and the existing authentication UI. It connects
to the configured CostFinders Supabase project.

```bash
cd frontend
npm ci
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
npm run dev
```

Open `http://localhost:3000`. Without Supabase credentials, `/` and `/deals`
show setup guidance instead of attempting to load live offers.

The demo uses a local-first Sora/Manrope font stack with a system-font fallback,
so its production build does not require access to Google Fonts.
