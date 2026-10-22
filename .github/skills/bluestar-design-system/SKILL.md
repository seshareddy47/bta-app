---
name: bluestar-design-system
description: "Use when: building or styling any UI component in the Blue Star India AC Shop Management System. Encodes CSS design tokens, card/table/form/button component JSX patterns, sidebar layout structure, and Blue Star brand guidelines. Load before creating any new component, page, or CSS."
---

# Blue Star Design System

## When to Use
- Creating any new React component or page
- Applying consistent styling to forms, tables, buttons, cards
- Setting up or extending the global CSS theme
- Implementing sidebar/topbar layout structure

## Design Tokens (from template.webp wireframe)

All tokens are CSS custom properties defined in `src/index.css` under `:root`.

```css
:root {
  /* Brand */
  --primary:        #0061d5;   /* Box blue — buttons, active states, charts */
  --primary-dark:   #3d30d4;   /* Hover/pressed primary */
  --primary-light:  rgba(80, 64, 240, 0.12); /* Primary tint — badges, focus rings */

  /* Surfaces */
  --bg:             #f0f0f0;   /* Page/app background (dominant from template) */
  --surface:        #ffffff;   /* Card, modal, sidebar panels */
  --surface-alt:    #e0e0e0;   /* Slightly darker surface — table rows alt, dividers */
  --teal-bg:        #d0e0e0;   /* Teal secondary accent — stat cards, chips */

  /* Text */
  --text:           #1a1a2e;   /* Primary text */
  --text-muted:     #606070;   /* Secondary/helper text */
  --text-inverse:   #ffffff;   /* Text on primary bg */

  /* Semantic */
  --success:        #22c55e;
  --success-bg:     rgba(34, 197, 94, 0.12);
  --warning:        #f59e0b;
  --warning-bg:     rgba(245, 158, 11, 0.12);
  --danger:         #ef4444;
  --danger-bg:      rgba(239, 68, 68, 0.12);

  /* Layout */
  --border:         #e0e0e0;
  --border-radius:  8px;
  --radius-lg:      12px;
  --radius-sm:      4px;
  --sidebar-width:  240px;
  --topbar-height:  60px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.10), 0 2px 4px rgba(0,0,0,0.06);
}
```

## Layout Structure

The app uses a **sidebar + topbar + main content** shell:

```
┌─ Sidebar (240px) ─┬─── TopBar (100% - 240px, 60px tall) ────┐
│  Logo             │  Page title          User avatar / logout│
│  ─────────────    ├──────────────────────────────────────────┤
│  Nav items        │                                          │
│  (active: primary)│           <Outlet /> / page content      │
│                   │                                          │
└───────────────────┴──────────────────────────────────────────┘
```

### CSS class conventions
```
.app-shell          — flex row, full height
.sidebar            — fixed left panel, --sidebar-width, --surface bg
.sidebar__logo      — logo/brand area at top of sidebar  
.sidebar__nav       — nav list container
.sidebar__nav-item  — individual nav link row
.sidebar__nav-item--active — active page highlight (--primary-light bg, --primary text)
.topbar             — top horizontal bar
.main-content       — scrollable right panel, --bg background, padding 24px
```

## Component Patterns

### Card
```tsx
<div className="card">
  <div className="card__header">
    <h3 className="card__title">Title</h3>
    <span className="card__badge card__badge--primary">Tag</span>
  </div>
  <div className="card__body">{/* content */}</div>
</div>
```
```css
.card { background: var(--surface); border-radius: var(--radius-lg); padding: 20px; box-shadow: var(--shadow-sm); border: 1px solid var(--border); }
.card__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.card__title { font-size: 16px; font-weight: 600; color: var(--text); margin: 0; }
```

### Stat Card (dashboard KPIs)
```tsx
<div className="stat-card">
  <span className="stat-card__icon">💰</span>
  <div>
    <p className="stat-card__label">Total Revenue</p>
    <p className="stat-card__value">₹12,40,000</p>
  </div>
</div>
```
```css
.stat-card { background: var(--surface); border-left: 4px solid var(--primary); border-radius: var(--border-radius); padding: 16px 20px; display: flex; gap: 16px; align-items: center; box-shadow: var(--shadow-sm); }
.stat-card__label { font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-card__value { font-size: 24px; font-weight: 700; color: var(--text); }
```

### Data Table
```tsx
<div className="table-wrapper">
  <table className="data-table">
    <thead>
      <tr>
        <th>Column</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Value</td>
      </tr>
    </tbody>
  </table>
</div>
```
```css
.table-wrapper { overflow-x: auto; border-radius: var(--border-radius); border: 1px solid var(--border); }
.data-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.data-table thead { background: var(--bg); }
.data-table th { padding: 12px 16px; text-align: left; font-weight: 600; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
.data-table td { padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--text); }
.data-table tbody tr:last-child td { border-bottom: none; }
.data-table tbody tr:hover { background: var(--teal-bg); }
```

### Button
```tsx
<button className="btn btn--primary">Save</button>
<button className="btn btn--secondary">Cancel</button>
<button className="btn btn--danger btn--sm">Delete</button>
```
```css
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: var(--border-radius); font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: background 0.15s, box-shadow 0.15s; }
.btn--primary { background: var(--primary); color: var(--text-inverse); }
.btn--primary:hover { background: var(--primary-dark); }
.btn--secondary { background: var(--surface-alt); color: var(--text); }
.btn--danger { background: var(--danger-bg); color: var(--danger); }
.btn--sm { padding: 5px 12px; font-size: 13px; }
```

### Form Field
```tsx
<div className="form-group">
  <label className="form-label" htmlFor="field-id">Label</label>
  <input className="form-input" id="field-id" type="text" placeholder="..." />
  <span className="form-error">Error message</span>
</div>
```
```css
.form-group { display: flex; flex-direction: column; gap: 4px; margin-bottom: 16px; }
.form-label { font-size: 13px; font-weight: 500; color: var(--text); }
.form-input, .form-select { padding: 9px 12px; border: 1px solid var(--border); border-radius: var(--border-radius); font-size: 14px; background: var(--surface); color: var(--text); outline: none; transition: border-color 0.15s; }
.form-input:focus, .form-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-light); }
.form-error { font-size: 12px; color: var(--danger); }
```

### Badge / Chip
```tsx
<span className="badge badge--success">Active</span>
<span className="badge badge--warning">Pending</span>
<span className="badge badge--danger">Cancelled</span>
<span className="badge badge--primary">Manager</span>
```
```css
.badge { display: inline-flex; align-items: center; padding: 2px 10px; border-radius: 99px; font-size: 12px; font-weight: 500; }
.badge--success { background: var(--success-bg); color: var(--success); }
.badge--warning { background: var(--warning-bg); color: var(--warning); }
.badge--danger { background: var(--danger-bg); color: var(--danger); }
.badge--primary { background: var(--primary-light); color: var(--primary); }
```

## Blue Star India Brand Guidelines
- Brand name: **Blue Star** (always two words, no abbreviation in user-facing text)
- Primary color emphasis: `--primary` (#0061d5) for CTA buttons, active nav items, chart fills
- Logo area in sidebar uses text: "🔵 Blue Star" + subtitle "Shop Manager"
- Product categories: Split AC, Window AC, Cassette AC, Tower AC
- Tonnage options: 1T, 1.5T, 2T
- Star ratings: 3★, 4★, 5★ (energy efficiency)

## Procedure: Adding a New Page
1. Create `src/pages/<PageName>Page.tsx`
2. Import and use `<Layout>` if standalone, or use as `<Outlet>` child under the shell
3. Wrap content in `<div className="page-container">`
4. Add the route to `src/App.tsx` router config
5. Add nav item to `src/components/Sidebar.tsx` with matching path

## File Locations Reference
- Design tokens: `src/index.css` (`:root` block)
- Shared component CSS: `src/styles/components.css`
- Page-level styles: co-located `PageName.css` or module
