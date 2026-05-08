# React + Supabase Dashboard Starter

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://makeapullrequest.com)

Production-ready React dashboard starter with Supabase authentication, shadcn/ui components, Tailwind CSS v4, i18n internationalization, and role-based access control (RBAC).

## Features

- **Supabase Auth** — Email/password authentication with automatic user profile creation
- **Role-Based Access Control** — `superadmin`, `admin`, and `editor` roles with protected routes
- **shadcn/ui Components** — Modern, accessible UI components (Button, Card, Input, DropdownMenu, Sheet, Avatar, Badge, Skeleton)
- **Tailwind CSS v4** — Utility-first CSS with dark mode support
- **i18n Ready** — Multi-language support with i18next (English + Spanish included)
- **React Router v7** — Client-side routing with protected layout routes
- **TypeScript** — Full type safety with Supabase-generated database types
- **React Hook Form + Zod** — Form validation and handling
- **Responsive Sidebar** — Collapsible sidebar navigation with role-based menu items
- **Dark Mode** — Theme toggle persisted to localStorage via useTheme hook

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (recommended) or npm/yarn
- [Supabase](https://supabase.com/) account (free tier works)

### 1. Create a project from this template

Click the **"Use this template"** button at the top of this repository.

### 2. Clone your new repo

```bash
git clone git@github.com:YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
pnpm install
```

### 3. Set up Supabase

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project
2. In your Supabase dashboard, go to **SQL Editor** and run the migration from `supabase/migrations/00001_initial_schema.sql`
3. Get your project URL and anon key from **Project Settings > API**

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Start the dev server

```bash
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) and sign up to create your first user.

> **Note:** After signing up, you'll need to manually set your role to `superadmin` in the Supabase Table Editor (`public.users` table) to access all features.

## Project Structure

```
src/
  components/
    layout/          # App shell (AppLayout, SidebarNav, Topbar, ProtectedRoute)
    ui/              # shadcn/ui components
  hooks/             # useAuth, useRole, useTheme
  i18n/
    locales/         # en.json, es.json
    index.ts         # i18next configuration
  lib/               # supabase client, utils (cn)
  pages/
    auth/            # LoginPage, SignupPage
    dashboard/       # OverviewPage (add your pages here)
    NotFoundPage.tsx
    UnauthorizedPage.tsx
  types/             # database.ts, index.ts
  App.tsx            # Route definitions
  main.tsx           # Entry point
  index.css          # Tailwind + theme variables
supabase/
  migrations/        # SQL migration files
```

## Database Setup

The initial migration (`supabase/migrations/00001_initial_schema.sql`) creates:

- `public.users` table — extends `auth.users` with role field
- RLS policies — users can read/update their own row
- Automatic user creation trigger on signup

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
