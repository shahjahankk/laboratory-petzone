# PetZone Laboratory

Simple cPanel-ready lab report software for PetZone — CBC, LFT, RFT, Electrolytes and more, same print pattern for every test.

## Features

- Staff login + first-time admin setup
- Patient / pet details on every report
- Select one or more test panels
- Enter results in a standard table (Parameter / Result / Unit / Reference / Flag)
- Printable report with PetZone logo
- MySQL database (phpMyAdmin import — no setup scripts)

## cPanel + Git deploy

Domain / app root: **laboratory-petzone.petzone.pk**

1. cPanel → **Git Version Control** → clone/pull `laboratory-petzone` into the app directory
2. cPanel → **Setup Node.js App**
   - Application root: `laboratory-petzone.petzone.pk`
   - Application URL: `laboratory-petzone.petzone.pk`
   - Startup file: `server.js` (or `app.js`)
   - Run **NPM Install** → **Start / Restart**
3. `.htaccess` is included (Passenger + DB env vars)
4. Database: `petzonep_laboratory-petzone` (tables already created)
5. Open the site → `/login` → create first admin

If your Node virtualenv path/version differs, update the `PassengerNodejs` line in `.htaccess`.

## Local run

```bash
cd laboratory-petzone
cp .env.example .env
# edit .env with your MySQL details
npm install
npm start
```

App runs on port **4060** by default.

## Default flow

1. Open `/login` and create admin (shown only when users table is empty)
2. Create report → select CBC / LFT / RFT / Electrolytes → enter values → Print
