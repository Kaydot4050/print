# Offline setup for the hospital local server

The Hospital Card Printer does not require an Internet connection at runtime.
It stores card entries in the browser on the local computer, uses the bundled
logo, and sends printing through the normal browser print dialog.

## Prepare the offline package

On a computer that has the project files and dependencies installed:

```bash
pnpm --filter @workspace/hospital-card-printer run build
```

Copy these items to the hospital's local server:

- `public/`
- `offline-server.mjs`
- `package.json` (optional, included so `npm start` works)

Node.js must be installed on the local server. The server does not need
Internet access after the built files have been copied.

## Start the local server

From the extracted offline package folder, run:

```bash
node offline-server.mjs
```

On Windows PowerShell:

```powershell
node .\offline-server.mjs
```

Do not run `pnpm run build` on the offline package. The application is already
compiled inside the `public/` folder. You can also start it with:

```bash
npm start
```

Open `http://localhost:8080` on the server computer. Other computers on the
same hospital network can open `http://SERVER-IP:8080`, where `SERVER-IP` is
the local IP address of the server computer.

If other computers cannot connect, allow TCP port `8080` through the server
computer's local firewall. No Internet firewall rule or public website is
needed.

## Printing with Magicard 300

Install the Magicard 300 printer driver on each computer that will print cards.
In the app, select the card version, enter the details, select **Print card**,
choose the Magicard 300, and use:

- Card size: CR80 / 85.6 × 53.98 mm
- Scale: 100% / Actual size
- Browser headers and footers: disabled
- Background graphics: enabled, if offered

The PVC card artwork, headings, and field labels are not printed. The print
layer outputs only the entered values and barcode so it can be aligned over
the pre-printed card.