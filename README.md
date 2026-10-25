# COATX-FLOW

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://makeapullrequest.com)

Mobile-first industrial coating work-record demo built with React, TypeScript, Tailwind CSS, and shadcn/ui.

## Features

- **Public shared test mode** — No sign-in; projects, items, work records, and document edits are shared through Supabase
- **Installable PWA** — Install from the hosted link; deployments offer an update without reinstalling
- **Worker homepage** — `/` opens the camera-first work-paper entry flow; `/dashboard` remains the back-office area
- **Camera and gallery photo selection** — Gallery upload is the first action; the camera opens only when requested. Use supported camera zoom, take a new photo, or replace it with a gallery image; keep the source photo alongside the editable review form
- **Korean/English work-paper OCR** — OCR.space auto-detects mixed-language text, corrects page rotation, and scales the compressed image; local matching checks the full recognized text and labeled project, product, quantity, and LOT fields against the project and item masters. The full OCR text is available in review; similar project names are offered for manual confirmation
- **Order documents** — Edit and save a Dijei Coat work-paper sheet and invoice for any saved order; print or save either sheet as PDF, and export a compact invoice workbook with item, unit price, quantity, and total columns
- **Explicit review before saving** — Manual and scanned entries share the same validation and confirmation flow
- **47 supplied project specifications** — Imported into browser storage on first use, searchable by project name and manually maintained aliases
- **Specification safety** — Imported specifications are marked pending verification, editable for each record, and saved as an unverified snapshot; actual coating stages require separate worker confirmation
- **Record-only project names** — An unmatched name can be saved on a work record without silently changing the project master
- **Item catalogue** — Add reusable items with an optional related project and a locally stored thumbnail; select saved items when entering orders
- **Automatic order date and name** — The submission date is set automatically, and the order name summarizes the selected project, item count, and quantities
- **Simple manual order** — Select one project and one saved item, enter an integer object count, then review the project's source coat names and thickness before submitting
- **shadcn/ui Components** — Modern, accessible UI components (Button, Card, Input, DropdownMenu, Sheet, Avatar, Badge, Skeleton)
- **Tailwind CSS v4** — Utility-first CSS with dark mode support
- **English and Korean** — Switch languages in the top bar; the selection is remembered in this browser
- **React Router v7** — Client-side routing
- **TypeScript** — Full type safety with Supabase-generated database types
- **React Hook Form + Zod** — Form validation and handling
- **Responsive Sidebar** — Collapsible navigation for dashboard, new records, history, and master data
- **Dark Mode** — Theme toggle persisted to localStorage via useTheme hook

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm/yarn

### 1. Create a project from this template

Click the **"Use this template"** button at the top of this repository.

### 2. Clone your new repo

```bash
git clone git@github.com:YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
pnpm install
```

### 3. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173). The worker homepage is at `/`; choose **Admin** from the menu to open `/dashboard`. The app needs the Supabase URL and anon key from `.env.local`, and the `00003_public_shared_testing.sql` migration must be applied before it can start. OCR.space photo recognition requires a free OCR.space API key in `.env.local`; see below.

Projects, items, work records, and document edits are shared through Supabase. On first start, existing browser demo data is copied into the shared table without replacing records already there. The public-test migration grants anonymous read/write access: anyone with the app link can read and alter the test data, so do not use confidential/customer information or production data. OCR recognition sends a compressed photo to OCR.space; do not scan confidential work papers. OCR suggestions prefill the editable review form; similar project names are suggestions only and must be confirmed against the paper. Fields OCR cannot read remain blank. Submissions appear in the shared work history.

From **Work History**, open **Create / edit paper and invoice** on a saved order to edit coating work-paper details and invoice fields. Document values are saved to Supabase with the order. Use **Save PDF** to download the A4 coating work paper. To share it through a supported device share sheet (including KakaoTalk or WhatsApp when available), choose **Prepare PDF to share**, then **Choose sharing app**; otherwise, the PDF downloads for manual attachment. **Print / Save as PDF** remains available as an alternate browser print flow. Use **Export Excel workbook** for a simple invoice with Dijei Coat, paying company, date, item, price per piece, quantity, line total, and a formula-based grand total. Empty work-paper fields do not prevent PDF generation. Verify all specifications before sharing; this test app does not issue tax-compliant invoices.

To enable OCR.space recognition, create a free API key from [OCR.space](https://ocr.space/ocrapi/freekey) and put it in the root `.env.local` file:

```dotenv
OCR_SPACE_API_KEY=your-ocr-space-key
```

Restart `pnpm dev` after setting the key. The key is read only by the local Vite development server and is never included in browser code. For Netlify, add `OCR_SPACE_API_KEY` as a server-side environment variable; the Netlify Function at `/api/work-paper/recognize` keeps it out of browser code.

The supplied 47-row coating list is merged into Supabase by stable source-row IDs on first startup without overwriting existing projects. All imported specifications remain **pending verification**. Check every specification against the controlled work paper before use. Scanned photos are not retained in saved records.

## Supabase and Netlify public test setup

1. In the Supabase project already configured in `.env.local`, open **SQL Editor** and run `supabase/migrations/00003_public_shared_testing.sql`.
2. In Netlify, connect the repository and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and the server-only `OCR_SPACE_API_KEY`. Never use a Supabase service-role key in the browser or a `VITE_` variable.
3. Build with `pnpm run build` and publish `dist` (already configured in `netlify.toml`).
4. Use the Netlify HTTPS URL as the app/download link. Visitors can install Dijei Coat from the in-app prompt; iPhone/iPad users must use Share → Add to Home Screen. A deployment updates the installed PWA; the app prompts to reload when the new version is ready.

The PWA is a web app, not an APK. Browsers require a user action to install, so the app cannot force the native installation dialog on every visit. The in-app install card appears until dismissed or installed. The anonymous database policy is for temporary public testing only and gives every visitor permission to change shared test rows.

## Project Structure

```
src/
  components/
    layout/          # App shell (AppLayout, SidebarNav, Topbar)
    ui/              # shadcn/ui components
  hooks/             # useTheme
  i18n/
    locales/         # en.json, ko.json
    index.ts         # i18next configuration
  lib/               # local demo storage, Supabase client, utils (cn)
  pages/
    dashboard/       # Dashboard, new record, history, and master data
    NotFoundPage.tsx
  types/             # database.ts, index.ts
  App.tsx            # Route definitions
  main.tsx           # Entry point
  index.css          # Tailwind + theme variables
supabase/
  migrations/        # SQL migration files
```

## Database Setup

The original starter migration (`supabase/migrations/00001_initial_schema.sql`) creates:

- `public.users` table — extends `auth.users` with role field
- RLS policies — users can read/update their own row
- Automatic user creation trigger on signup

The original authenticated migration (`supabase/migrations/00002_work_records.sql`) describes a future COATX-FLOW work-record slice:

- Projects and items (master data), work records, and item snapshots
- RLS on every new table; authenticated users can read, while only admins can maintain master data
- A transaction-backed `submit_work_record` function that checks the user, project, and item rows
- New item proposals are saved only as record snapshots; they are never silently inserted into the item master
- Signup roles are always set to `editor`; an administrator must promote approved accounts

The current no-login test app uses the independent `00003_public_shared_testing.sql` migration. Apply it in the Supabase SQL Editor; the app does not apply remote migrations automatically. The public policy is strictly for temporary testing and must be replaced before production use.

### Generating database types

When you add tables to your Supabase project, regenerate types:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

Update the `Database` interface in that file to include your new tables.

## Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `pnpm dev`        | Start development server             |
| `pnpm build`      | Build for production                 |
| `pnpm preview`    | Preview production build             |
| `pnpm lint`       | Run ESLint                           |

## Customizing

### Adding a new page

1. Create your page in `src/pages/dashboard/YourPage.tsx`
2. Add the route in `src/App.tsx` under the dashboard layout:
   ```tsx
   <Route
     path="your-path"
     element={
       <ProtectedRoute requiredRole="admin">
         <YourPage />
       </ProtectedRoute>
     }
   />
   ```
3. Add a nav item in `src/components/layout/SidebarNav.tsx`

### Adding a new role

1. Add the role to the `Role` type in `src/types/database.ts`
2. Update the check constraint in the migration file
3. Add role-based logic in `ProtectedRoute.tsx` and `SidebarNav.tsx`

### Adding a new locale

1. Add your translation file in `src/i18n/locales/` (e.g., `fr.json`)
2. Add the locale to the `supportedLngs` array in `src/i18n/index.ts`

## License

MIT © [Your Name](https://github.com/YOUR_USERNAME)
