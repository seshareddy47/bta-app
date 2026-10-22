# Google Sheet ↔ Service Tab sync

The Service tab reads/writes to your Google Sheet through a small Apps Script
"Web App" that lives inside the spreadsheet itself. No Google Cloud project,
OAuth, or backend server is needed.

Your sheet: https://docs.google.com/spreadsheets/d/1lhAgdtd-Kuo6HujFATKi8UybNuPIpAkS7LqzQmFnyIY/edit

Expected header row (first sheet/tab, row 1), in any order:

```
Serial No | Service No | Complaint Date | Customer Name | Mobile | Area |
Town/Village | Invoice Number | Invoice Date | Model Number |
Type of Complaint | Attended Date | Technician | Status
```

`Service No` is used as the unique key for updates/deletes — don't leave it blank.

## 1. Deploy the script

1. Open the sheet above, then **Extensions → Apps Script**.
2. Delete the default `Code.gs` contents and paste in the contents of
   [`Code.gs`](./Code.gs) from this folder.
3. Click **Deploy → New deployment**.
4. Click the gear icon next to "Select type" and choose **Web app**.
5. Set:
   - **Execute as:** Me (your account)
   - **Who has access:** Anyone
6. Click **Deploy**, authorize the requested permissions (it only touches this
   spreadsheet), and copy the **Web app URL** it gives you
   (`https://script.google.com/macros/s/…/exec`).

> If you later edit `Code.gs`, use **Deploy → Manage deployments → Edit →
> New version** so the change goes live — just saving the file isn't enough.

## 2. Point the app at it

In the project root, create `.env.local` (already git-ignored) with:

```
VITE_SHEETS_WEB_APP_URL=https://script.google.com/macros/s/XXXXXXXX/exec
```

Restart `npm run dev` (or rebuild) after adding/changing this value.

## 3. How it behaves

- On load, the Service tab pulls all rows from the sheet and merges them in
  (matched by `Service No`).
- Adding, editing, or deleting a service in the app pushes that change to the
  sheet immediately (best-effort — a network hiccup won't block the UI, but
  the sync badge in the Service page header will show "Sync error").
- Use the **⟳ Sync with Sheet** button to manually re-pull the latest sheet
  data at any time (e.g. after editing rows directly in Google Sheets).
- The sheet only stores the technician's name, not an internal ID, so rows
  added directly in the sheet will show correctly but won't have a technician
  pre-selected when edited in the app until you pick one from the dropdown.
