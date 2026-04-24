# Changelog

All notable changes to Math Dungeon are documented here. Version numbers follow [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-04-24

### Added
- **Settings modal** on the home screen with difficulty and hero-look controls.
- **Difficulty presets** — Easy, Medium, Hard, Challenging, Expert. Each chooses which operations (`+`, `-`, `×`, `÷`) show up and caps the largest number in a question.
- **Hero look toggle** — default / boy / girl, which swaps the avatar's hair style.
- **Version tag** shown in the home screen footer.
- **Newest-first inventory** with rarity filter chips and per-slot counts, so the item list stays browsable as the catalog grows.
- **Email + 6-digit code login** replacing the magic-link click flow. Session persists indefinitely on the Supabase Free tier.
- Supabase migrations directory (`supabase/migrations/`) so schema changes flow through `supabase db push`.
- GitHub Actions workflow auto-enables GitHub Pages on first run.

### Fixed
- `Star` component no longer balloons into giant polygons when its props come in as JSX string attributes — Gem Tiara, Top Hat, and Star Jacket now render correctly.

### Changed
- Preferences (difficulty, hero look) are stored in `localStorage` only. They do not round-trip through the Supabase cloud save yet.

## [0.1.0] - Initial release

- Math battles against dungeon enemies with +/- questions.
- Reward-box loot drops feeding a 7-slot avatar (hat, face, shirt, pants, cape, aura, tool).
- Guest saves via `localStorage`; signed-in players get Supabase cloud save with per-user Row Level Security.
