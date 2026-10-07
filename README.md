# Entrava

Show ticketing in three sites: fans buy and hold tickets, hosts put shows on sale, gate staff check guests in.

This repository is the working front-end prototype. It runs with no server: every page is a single self-contained HTML file.

## The three sites

| Page | Who it is for | Live address it is meant for |
| --- | --- | --- |
| `index.html` | Fans: sign in, see shows, buy, hold and transfer tickets | `entrava.com` |
| `host/index.html` | Hosts: sign up, upload shows and tickets, see every ticket sold | `host.entrava.com` |
| `checkin/index.html` | Gate staff: sign in with a Gate ID and PIN, scan guests in | `checkin.entrava.com` |

On a real domain the same code detects the `host.` and `checkin.` subdomains by itself.

## Run it

Open `index.html` in a browser, or serve the folder:

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`, `/host/` and `/checkin/`.

To try the whole flow:

1. On `/host/`, create a host account and choose paid tickets, then press "Add sample shows".
2. On `/`, create a fan account and buy tickets.
3. On `/host/`, open the show and press "Send tickets now" so the QR codes unlock. Note a Gate ID and PIN under "Gate logins".
4. On `/checkin/`, sign in with that Gate ID and PIN and scan the ticket.

Entrava staff view: the "Entrava staff sign in" link on the host sign-in page, passcode `2026`.

## Change it

Edit the files in `src/`, then rebuild the three pages:

```
python3 build.py
```

## Put it on GitHub Pages

In the repository on GitHub: Settings, then Pages, then deploy from the `main` branch, root folder. The site appears at `https://<your-username>.github.io/<repository-name>/`.

## What is real and what is simulated

This matters before anyone sells a real ticket.

- **Data lives in each visitor's own browser.** There is no shared database yet, so a show a host creates on one device does not appear for a fan on another device. Everything works end to end on a single device.
- **Sign-in is a demo.** Passwords are not stored securely and "Continue with Google" is a stand-in for Google's real window.
- **Payments are a demo.** The Paystack, Flutterwave and Stripe screens move no money.
- **Emails are not sent.** The Inbox tab under "My tickets" shows what would be sent.
- **Wallet passes are previews.** Real Apple Wallet and Google Wallet passes need issuer accounts and server-side signing.
- **The seal is drawn in the browser.** To be hard to forge, tickets must be signed on a server with a key the browser never sees.

See `CLAUDE.md` for the product rules and the plan for the real build.
