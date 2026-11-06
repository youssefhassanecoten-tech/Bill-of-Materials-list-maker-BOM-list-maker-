# BOM Studio

A browser-based Bill of Materials maker for individuals and small teams.

## Features

- Editable BOM table with categories, quantities, units, material and labour costs.
- Live totals: material, labour, overhead, contingency, margin, VAT and grand total.
- Project metadata, currency selection and editable assumptions.
- Templates: scanner enclosure, metal/wood/glass fabrication, blank BOM.
- BOM health checks: missing costs, supplier and lead-time coverage.
- Should-cost target and variance against the calculated grand total.
- Upload a BOM PDF and extract its text in the browser (PDF.js) for line import.
- Export PDF through the browser print dialog.
- Export DOCX, JSON and CSV.
- Local draft storage in the browser.

## Sample BOM

The `bom/` folder contains a planning BOM for the scanner enclosure covering electronics, metalwork, woodwork, glasswork and assembly/calibration labour.

Files:
- `bom/scanner-bom.pdf`
- `bom/scanner-bom.docx`
- `bom/scanner-bom.csv`
- `bom/scanner-bom.json`

All prices are planning estimates in RUB. Blank supplier, lead-time and identification fields are intentionally left empty for supplier input. Replace estimates with actual quotes before purchasing.

## Run

The application is static. Serve the repository root with any static server, for example:

```bash
python -m http.server 8900
```

Then open `http://localhost:8900/`.

## Deployment

Static hosting (GitHub Pages or equivalent). No server-side component is required.
