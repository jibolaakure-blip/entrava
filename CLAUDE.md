# Entrava: project brief

Entrava is a show ticketing platform for Nigeria, built by Temzyola Tech Limited. This file is the context for continuing the build.

## Product rules (decided by the owner)

- Three separate sites, never one mixed interface:
  - `entrava.com` for fans. Shows and tickets are visible only after sign-in. Sign-in by email and password, or Google.
  - `host.entrava.com` for hosts. Sign-up by email and password, or Google.
  - `checkin.entrava.com` for gate staff to check guests in.
- Host sign-up asks: do you have tickets to sell, and are they free or paid.
  - Paid: Entrava charges a 5% management fee per sale. In the prototype it is deducted from the host's payout; the fan pays the listed price. Confirm with the owner before changing.
  - Free: the host must contact Entrava to agree a management fee. The account stays locked until Entrava staff approve it with the agreed fee.
- Fans get a confirmation on purchase. The ticket (PDF with event details and a unique QR code) is released 12 hours before the show.
- The QR code is only scannable inside the check-in site, by staff with a gate login. Hosts choose how many gate logins they need; the default is two, a male lane and a female lane.
- A scan shows the holder's name, email, time of purchase and the seal, then asks to check the guest in. A ticket admits once.
- Tickets can be transferred to another email. A transfer re-issues the QR code and seal; the old code stops working.
- Each show has a maximum number of tickets per buyer, to stop unauthorised reselling.
- Hosts (and Entrava staff) can see every ticket bought, its full details, and transfer it.
- Checkout offers Paystack, Flutterwave and Stripe.
- Tickets can be added to Apple Wallet and Google Wallet.
- Every ticket carries a seal of authenticity and must be hard to forge.

## Design direction (decided by the owner)

- White background, one bright colour (electric blue `#2036FF`) and one accent that stands out (hot pink `#FF2E7E`). Dark mode is required.
- The home page hero is a 3D, video-like arena scene, in the spirit of the O2 Arena site.
- Buttons are animated. Shows pop in on scroll and their posters move like footage.
- It must look extraordinary and must not look like a generic generated site. The owner rejected an earlier, plainer version outright.
- Typeface: Archivo, with the expanded width for headlines.

## What exists today

A front-end prototype in vanilla HTML, CSS and JavaScript, no framework and no build tooling beyond `build.py`.

- `src/app.js`: all logic. Sections are marked with comment banners: store, derived data, UI state, theme, seal, posters, 3D arena (three.js r128 from a CDN), scroll reveal, ticket, shows, checkout, my tickets, PDF, gate, host site, dialogs, actions (`ACT`), forms (`FORMS`), render.
- `src/style.css`: all styles. Colours are tokens on `:root`, redefined for dark mode.
- `src/body.html`: the page skeleton.
- `build.py`: writes `index.html`, `host/index.html` and `checkin/index.html`, identical except for `data-site` on `<html>`. `app.js` reads it as `LOCK`, and also recognises real `host.` and `checkin.` subdomains.

Data model (collections of JSON documents): `events`, `tickets`, `orders`, `passes` (gate logins), `users` (fans), `hosts`.

The store has two modes. Outside Claude it uses `localStorage` (per browser). The `window.claude` branch only applies when the page runs as a Claude artifact and can be removed once a real backend exists.

## What is simulated and must become real

1. Shared database and real accounts. Nothing is shared between devices today.
2. Authentication: real password handling and real Google sign-in. The current hash is not secure.
3. Payments: server-side Paystack, Flutterwave and Stripe, confirmed by webhooks, with the 5% fee recorded per order.
4. Email: purchase confirmation at once, the PDF ticket 12 hours before the show.
5. Ticket security: sign each ticket on the server; the browser must never hold the signing key. Check-in must be enforced on the server so a ticket cannot be admitted twice from two gates.
6. Access control: a fan sees only their own tickets, a host only their own shows, gate staff only their show.
7. Apple Wallet and Google Wallet passes.
8. Three real subdomains.

## Working rules

- Keep all existing behaviour and the visual design unless the owner asks for a change.
- Write interface text in plain language, from the user's side.
- Say plainly what is real and what is simulated. Do not present demo features as finished.
