# Math Dungeon

A mobile-friendly browser math game for young kids. Answer addition and subtraction questions to defeat dungeon enemies, open reward boxes, and collect cute, cool, and fancy avatar decorations.

## Run locally

```sh
npm install
npm run dev
```

Create `.env.local` if you want to override the Supabase values:

```sh
VITE_SUPABASE_URL=https://esalgojhghuonrqoxcqm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_aIqsiNIBPAf1LiJNUoUToQ_DEooIgjN
```

The app still works as a guest game if Supabase auth is unavailable, but signed-in players get cloud saves.

## Supabase setup

The schema lives under [supabase/migrations/](supabase/migrations/) as a single `init_game_saves` migration that creates `public.game_saves` with Row Level Security so each signed-in player can only read and write their own save. Apply it with:

```sh
npx supabase link --project-ref esalgojhghuonrqoxcqm
npx supabase db push
```

Or paste the migration file into the Supabase SQL editor.

### Auth: email + 6-digit code

Login is email + one-time 6-digit code (no magic-link click). Two dashboard settings make this work:

1. **Authentication → Providers → Email**: enable the Email provider.
2. **Authentication → Email Templates → Magic Link**: replace the body with a version that shows the code instead of a URL — for example:

   ```html
   <h2>Your Math Dungeon code</h2>
   <p>Enter this 6-digit code to sign in:</p>
   <p style="font-size:28px;letter-spacing:6px;font-weight:bold">{{ .Token }}</p>
   <p>It expires in 1 hour.</p>
   ```

   The key change is `{{ .Token }}` in place of `{{ .ConfirmationURL }}`. Supabase sends the same email for both the magic-link and code flows; what the user sees is controlled by this template.

3. **Authentication → Sessions**: set "Time-box user sessions" to `604800` (7 days) so signed-in players stay signed in for a week before the next code prompt.

Redirect URLs are no longer needed for the login flow, but you can still add them under **Authentication → URL Configuration** if you plan to use password recovery or other link-based flows later.

## Build

```sh
npm run build
```

## GitHub Pages

The workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds on every push to `main` and publishes `dist/` to GitHub Pages. In the GitHub repo settings, set Pages source to **GitHub Actions**.
