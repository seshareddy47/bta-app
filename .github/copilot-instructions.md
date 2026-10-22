# Blue Star AC Shop Manager — Copilot Instructions

## Project Overview
A **Blue Star India AC Shop Management System** built with React 19 + TypeScript + Vite.
No backend — all data persists in `localStorage`.

## Tech Stack
- **React 19** + **TypeScript** (strict mode)
- **Vite 8** as build tool
- **react-router-dom v7** for client-side routing
- **recharts** for sales/revenue charts
- **No UI library** — custom CSS using design system tokens

## Skills Available (load these when relevant)
| Skill | When to load |
|-------|-------------|
| `bluestar-design-system` | Any component/styling work |
| `sales-management` | Sales CRUD, charts, reports |
| `employee-management` | Employee CRUD |
| `stock-management` | Stock/inventory CRUD |
| `auth-flow` | Login, signup, route protection |

## Project File Conventions
- Types: `src/types/index.ts`
- Context providers: `src/context/`
- Pages: `src/pages/`  
- Shared components: `src/components/`
- Utilities: `src/utils/helpers.ts`
- Global CSS tokens: `src/index.css` (`:root` block)
- Component CSS: `src/styles/components.css`

## Code Conventions
- Always use named exports (not default) for components
- Use `useData()` hook for all data operations (sales, employees, stocks)
- Use `useAuth()` hook for authentication state
- Format all rupee values with `formatRupees()` from `src/utils/helpers.ts`
- Use CSS classes from the design system — never inline styles except for dynamic values
- IDs are generated with `crypto.randomUUID()` or `generateId()` helper

## Blue Star India Branding
- Brand: "Blue Star India" — AC product categories: Split, Window, Cassette, Tower
- Tonnage: 1T, 1.5T, 2T | Star ratings: 3★, 4★, 5★
- Primary color: `#0061d5` (Box blue) — defined as `--primary` CSS var
