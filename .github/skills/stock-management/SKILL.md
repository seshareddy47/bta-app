---
name: stock-management
description: "Use when: adding, viewing, or managing AC product stock/inventory in the Blue Star AC Shop. Covers the Stock TypeScript model for Blue Star categories (split/window/cassette/tower AC, tonnage, star rating), StockTable with low-stock color alerts, and AddStockForm. Load when working on any inventory or stock feature."
---

# Stock Management

## When to Use
- Implementing the Add Stock / Product form
- Building or modifying the stock/inventory data table
- Displaying low-stock alerts with color coding
- Extending the Stock data model

## TypeScript Model

```typescript
// src/types/index.ts
export type AcCategory = 'split-ac' | 'window-ac' | 'cassette-ac' | 'tower-ac';
export type AcTonnage = '1T' | '1.5T' | '2T';
export type StarRating = 3 | 4 | 5;

export interface Stock {
  id: string;           // UUID
  sku: string;          // e.g. "BS-SP-15-5S"
  productName: string;  // e.g. "Blue Star 1.5T 5★ Split AC"
  category: AcCategory;
  tonnage: AcTonnage;
  starRating: StarRating;
  modelNumber: string;  // official Blue Star model no.
  price: number;        // MRP in rupees
  quantity: number;     // units in stock
  minStock: number;     // threshold for low-stock warning
  location: string;     // warehouse/shelf location e.g. "Rack A-3"
  lastUpdated: string;  // ISO date
}
```

## StockTable Columns

| Column | Key | Sortable | Format |
|--------|-----|---------|--------|
| SKU | sku | - | monospace |
| Product Name | productName | ✓ | plain text |
| Category | category | - | formatted label |
| Tonnage | tonnage | - | plain (1T / 1.5T / 2T) |
| Rating | starRating | - | star display (★★★★★) |
| MRP | price | ✓ | ₹ formatted |
| In Stock | quantity | ✓ | colored number cell |
| Min Stock | minStock | - | number |
| Location | location | - | plain text |
| Actions | - | - | Edit / Add Units icon buttons |

### Low-stock color coding
```tsx
function StockQtyCell({ quantity, minStock }: { quantity: number; minStock: number }) {
  const cls = quantity === 0 ? 'stock-cell--out'
    : quantity <= minStock ? 'stock-cell--low'
    : 'stock-cell--ok';
  return <span className={`stock-cell ${cls}`}>{quantity}</span>;
}
```
```css
.stock-cell { font-weight: 600; padding: 3px 10px; border-radius: 99px; font-size: 13px; }
.stock-cell--ok  { background: var(--success-bg); color: var(--success); }
.stock-cell--low { background: var(--warning-bg); color: var(--warning); }
.stock-cell--out { background: var(--danger-bg);  color: var(--danger); }
```

### Star rating display
```tsx
function StarDisplay({ rating }: { rating: StarRating }) {
  return (
    <span className="star-display" title={`${rating} Star`}>
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}
```

### Category label map
```typescript
export const CATEGORY_LABELS: Record<AcCategory, string> = {
  'split-ac':    'Split AC',
  'window-ac':   'Window AC',
  'cassette-ac': 'Cassette AC',
  'tower-ac':    'Tower AC',
};
```

## AddStockForm Fields & Validation

| Field | Input Type | Validation |
|-------|-----------|-----------|
| Product Name | text | Required |
| SKU | text | Required, auto-generated, editable |
| Category | select | Required |
| Tonnage | select | Required: 1T / 1.5T / 2T |
| Star Rating | select | Required: 3 / 4 / 5 |
| Model Number | text | Required |
| MRP (₹) | number | Required, > 0 |
| Initial Quantity | number | Required, ≥ 0 |
| Min Stock | number | Required, ≥ 0 |
| Location | text | Required |

### SKU auto-generation
```typescript
export function generateSku(category: AcCategory, tonnage: AcTonnage, starRating: StarRating): string {
  const catCode = { 'split-ac':'SP','window-ac':'WN','cassette-ac':'CS','tower-ac':'TW' }[category];
  const tonCode = tonnage.replace('.', '').replace('T', '');
  return `BS-${catCode}-${tonCode}-${starRating}S`;
}
// e.g. "BS-SP-15-5S" for Split AC, 1.5T, 5-star
```

## Procedure: Add the Stocks Page
1. Ensure `Stock` interface exists in `src/types/index.ts`
2. Add `stocks` array + `addStock` / `updateStock` / `decrementStock` to `DataContext`
3. `decrementStock(productId, qty)` — called when a sale is completed to reduce quantity
4. Seed initial stock data in localStorage if empty
5. Create `src/pages/StocksPage.tsx` with view state: `'table' | 'add'`
6. Show a summary banner at the top: X items low-stock in amber, Y out-of-stock in red
7. Register route: `<Route path="/stocks" element={<StocksPage />} />`
8. Add nav item "Stocks" with icon to `Sidebar.tsx`

## Sample Seed Data
```typescript
export const SEED_STOCKS: Stock[] = [
  { id: 'stk-1', sku: 'BS-SP-15-5S', productName: 'Blue Star 1.5T 5★ Split AC',
    category: 'split-ac', tonnage: '1.5T', starRating: 5, modelNumber: 'FS518YATU',
    price: 58000, quantity: 12, minStock: 5, location: 'Rack A-1', lastUpdated: '2025-01-01' },
  { id: 'stk-2', sku: 'BS-SP-10-3S', productName: 'Blue Star 1T 3★ Split AC',
    category: 'split-ac', tonnage: '1T', starRating: 3, modelNumber: 'IC310YATU',
    price: 34000, quantity: 3, minStock: 5, location: 'Rack A-2', lastUpdated: '2025-01-01' },
  { id: 'stk-3', sku: 'BS-WN-10-3S', productName: 'Blue Star 1T 3★ Window AC',
    category: 'window-ac', tonnage: '1T', starRating: 3, modelNumber: 'AC3W10YA',
    price: 28000, quantity: 0, minStock: 3, location: 'Rack B-1', lastUpdated: '2025-01-01' },
];
```
