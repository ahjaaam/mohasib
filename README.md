# Mohasib — محاسب

**AI-powered accounting SaaS for Moroccan SMEs**

Built with Next.js 14, Supabase, Tailwind CSS, and the Anthropic SDK.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth & DB | Supabase (PostgreSQL + Auth) |
| Styling | Tailwind CSS |
| AI | Anthropic Claude (claude-opus-4-6) |
| Charts | Recharts |
| Icons | Lucide React |

## Color Scheme

| Color | Hex |
|---|---|
| Navy sidebar | `#0D1526` |
| Gold accent | `#C8924A` |
| Cream background | `#FAFAF6` |

---

## Getting Started

### 1. Clone & Install

```bash
cd mohasib
npm install
```

### 2. Configure Environment

```bash
cp .env.local.example .env.local
```

Fill in your keys in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. Set Up Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration:

```bash
# Contents of: supabase/migrations/001_init.sql
```

Or if you have the Supabase CLI:

```bash
supabase db push
```

### 4. Configure Supabase Auth

In the Supabase dashboard:
- Go to **Authentication → URL Configuration**
- Set **Site URL** to `http://localhost:3000`
- Add Redirect URL: `http://localhost:3000/auth/callback`

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/auth/login`.

---

## Project Structure

```
src/
├── app/
│   ├── (app)/                  # Protected routes (with sidebar)
│   │   ├── layout.tsx          # App shell with sidebar
│   │   ├── dashboard/          # Dashboard with charts & KPIs
│   │   ├── invoices/           # Invoice list + detail
│   │   │   └── new/            # New invoice form
│   │   ├── clients/            # Client management
│   │   ├── transactions/       # Income & expense tracking
│   │   └── chat/               # AI accounting assistant
│   ├── auth/
│   │   ├── login/              # Login page
│   │   ├── signup/             # Registration page
│   │   └── callback/           # OAuth callback handler
│   └── api/
│       └── chat/               # Streaming AI endpoint (Anthropic)
├── components/                 # Shared UI components
├── lib/
│   ├── supabase/               # Supabase clients (browser/server/middleware)
│   └── utils.ts                # Formatters, constants
└── types/                      # TypeScript interfaces
```

---

## Database Schema

### Tables

- **`users`** — Extends Supabase auth, stores company info (ICE, RC, IF fiscal)
- **`clients`** — Client/customer records
- **`invoices`** — Invoices with line items (JSONB), TVA calculation, status workflow
- **`transactions`** — Income & expense tracking with categorization

All tables have **Row Level Security** enabled — users can only access their own data.

### Invoice Status Flow

```
draft → sent → paid
            ↘ overdue
              ↘ cancelled
```

---

## Features

- **Dashboard** — KPI cards, revenue trend chart, revenue vs expenses bar chart
- **Invoices** — Create, list, view invoices; Moroccan TVA (20% default); status management
- **Clients** — Client card grid with ICE/RC fields for Moroccan businesses
- **Transactions** — Income/expense log with categories and payment methods
- **AI Chat** — Streaming chat with Claude, specialized in Moroccan accounting law (PCGM, CGI, TVA, IS, IR)
- **Auth** — Email/password with Supabase Auth; RLS secures all data

---

## Deployment

### Vercel (recommended)

```bash
vercel --prod
```

Add all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

Update Supabase Auth redirect URL to your production domain.
