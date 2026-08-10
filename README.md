# PetZone Laboratory

Simple cPanel-ready lab report software for PetZone — CBC, LFT, RFT, Electrolytes and more, same print pattern for every test.

## Features

- Staff login + first-time admin setup
- Patient / pet details on every report
- Select one or more test panels
- Enter results in a standard table (Parameter / Result / Unit / Reference / Flag)
- Printable report with PetZone logo
- MySQL database (import SQL in phpMyAdmin — no setup scripts)

## cPanel deploy

1. Upload this folder to your Node app directory on cPanel
2. Create a MySQL database + user in cPanel
3. Import `database/schema.sql` in phpMyAdmin
4. Copy `.env.example` to `.env` and fill DB credentials
5. In cPanel Node.js App: set startup file to `server.js`, run npm install, start the app
6. Open the site → Login → create the first admin account

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

1. Import schema
2. Open `/login` and create admin (shown only when users table is empty)
3. Create report → select CBC / LFT / RFT / Electrolytes → enter values → Print
