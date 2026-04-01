# 🌱 Farm OS

A full-stack Farm Operating System connecting paddocks, agronomy, staff, fuel, suppliers, and finance in one platform.

---

## Stack

| Layer     | Tech                                     |
|-----------|------------------------------------------|
| Frontend  | Next.js 14 · React · Tailwind CSS        |
| Backend   | NestJS · TypeScript                      |
| Database  | PostgreSQL (Neon)                        |
| Auth      | JWT (passport-jwt)                       |
| Charts    | Recharts                                 |
| Forms     | React Hook Form                          |
| API State | TanStack Query                           |

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

**API** — copy and fill in:
```bash
cp apps/api/.env.example apps/api/.env
```

The `.env` already has your Neon connection string pre-filled:
```
DATABASE_URL=postgresql://neondb_owner:npg_I92RbErqHPAo@ep-quiet-sun-a1lotmv6-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=your-super-secret-jwt-key-change-in-production
PORT=3001
```

**Web** — copy and fill in:
```bash
cp apps/web/.env.example apps/web/.env.local
```

### 3. Run the database migration

```bash
# Option A — psql
psql $DATABASE_URL -f packages/db/migrations/001_initial_schema.sql

# Option B — paste the SQL file directly into your Neon console
```

### 4. Seed demo data

```bash
cd packages/db
DATABASE_URL="your-neon-url" node seed.js
```

This creates:
- 1 farm (Riverdale Station)
- 5 users (owner, manager, staff, agronomist, supplier)
- 5 paddocks with crops
- Recommendations, timesheets, fuel logs, supplier orders
- Financial transactions wired up automatically

### 5. Start development servers

```bash
# Both API + Web concurrently
npm run dev

# Or individually
npm run dev:web   # http://localhost:3000
npm run dev:api   # http://localhost:3001
```

### 6. Login

```
Email:    owner@farm.com
Password: password123
```

---

## Project Structure

```
farm-os/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── app/
│   │   │   ├── dashboard/      # Main dashboard
│   │   │   ├── paddocks/       # Paddock CRUD
│   │   │   ├── staff/          # Timesheets + fuel logs
│   │   │   ├── agronomist/     # Recommendations + approvals
│   │   │   ├── supplier/       # Supplier orders
│   │   │   └── finance/        # P&L + cost breakdown
│   │   ├── components/
│   │   │   ├── ui/             # Shared UI components
│   │   │   └── layout/         # Sidebar, AppLayout
│   │   ├── lib/                # API client, utils
│   │   └── types/              # Shared TypeScript types
│   │
│   └── api/                    # NestJS backend
│       └── src/
│           ├── common/
│           │   ├── auth/       # JWT auth, strategies, guards
│           │   └── database/   # Neon PostgreSQL pool
│           └── modules/
│               ├── farms/
│               ├── paddocks/
│               ├── users/
│               ├── timesheets/
│               ├── fuel-logs/
│               ├── recommendations/
│               ├── supplier-orders/
│               ├── payments/
│               ├── financial-transactions/
│               └── dashboard/
│
└── packages/
    └── db/
        ├── migrations/         # SQL schema
        └── seed.js             # Demo data
```

---

## API Endpoints

All endpoints require `Authorization: Bearer <token>` except `/auth/login`.

| Method | Path                              | Description                        |
|--------|-----------------------------------|------------------------------------|
| POST   | /auth/login                       | Login → returns JWT                |
| GET    | /auth/me                          | Current user profile               |
| GET    | /farms                            | List all farms                     |
| POST   | /farms                            | Create farm                        |
| GET    | /paddocks?farm_id=                | List paddocks (optional filter)    |
| POST   | /paddocks                         | Create paddock                     |
| PATCH  | /paddocks/:id                     | Update paddock                     |
| DELETE | /paddocks/:id                     | Delete paddock                     |
| GET    | /timesheets?paddock_id=           | List timesheets                    |
| POST   | /timesheets                       | Log hours (auto-creates FT)        |
| GET    | /fuel-logs?paddock_id=            | List fuel logs                     |
| POST   | /fuel-logs                        | Log fuel (auto-creates FT)         |
| GET    | /recommendations?status=          | List recommendations               |
| POST   | /recommendations                  | Create recommendation (draft)      |
| PATCH  | /recommendations/:id/status       | Approve / reject                   |
| GET    | /supplier-orders?status=          | List orders                        |
| POST   | /supplier-orders                  | Create order (auto-creates FT)     |
| PATCH  | /supplier-orders/:id/status       | Update order status                |
| GET    | /financial-transactions           | All transactions                   |
| GET    | /payments                         | All payments                       |
| GET    | /dashboard/stats                  | Summary stats                      |
| GET    | /dashboard/paddock-summaries      | Per-paddock cost breakdown         |

Swagger UI: http://localhost:3001/api/docs

---

## Database Schema (9 tables)

```
farms → paddocks → recommendations
                → timesheets → financial_transactions
                → fuel_logs  → financial_transactions
                → supplier_orders → financial_transactions
farms → users
payments (linked to timesheets / fuel_logs / supplier_orders)
```

---

## User Roles

| Role        | Access                                          |
|-------------|-------------------------------------------------|
| owner       | Full access to all modules                      |
| manager     | All operational modules, no user admin          |
| staff       | Timesheet + fuel entry only                     |
| agronomist  | Recommendations, read-only paddocks             |
| supplier    | View and update their own orders                |

---

## MVP Sprint Reference (from Blueprint)

| Day   | Deliverable                          | Status  |
|-------|--------------------------------------|---------|
| 1–2   | Repo, auth, DB schema, deploy        | ✅ Done |
| 3–4   | Farms, paddocks, crop records        | ✅ Done |
| 5–6   | Staff: timesheets, fuel logs         | ✅ Done |
| 7–8   | Agronomist: recommendations          | ✅ Done |
| 9–10  | Supplier: orders, status tracking    | ✅ Done |
| 11–12 | Finance: cost aggregation, P&L       | ✅ Done |
| 13–14 | Dashboard, QA, pilot deploy          | 🔜 Next |

---

## Next Steps (Phase 2 — Weeks 3–4)

- [ ] Forecast engine (end-of-season margin prediction)
- [ ] Benchmark cohort comparison
- [ ] Approval workflow (manager approves recommendations)
- [ ] Richer onboarding flow with CSV/KML upload
- [ ] Push notifications for pending items
- [ ] Xero / MYOB integration (choose one)
- [ ] Multi-farm support
- [ ] Role-based route protection (frontend)
- [ ] Mobile-optimised staff app

---

## Deployment

**Frontend (Vercel):**
```bash
# Connect GitHub repo to Vercel
# Set env var: NEXT_PUBLIC_API_URL=https://your-api.railway.app
```

**Backend (Railway / Render):**
```bash
# Connect GitHub repo
# Set all vars from apps/api/.env.example
# Build command: npm run build
# Start command: npm run start:prod
```
#   f a r m - o s  
 