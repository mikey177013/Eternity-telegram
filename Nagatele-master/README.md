# ZeroTwo — Telegram Bot

> A modular, feature-rich Telegram bot built by **ETERNITY BOTS**.
> Owner: **sano.senxpai**

ZeroTwo is the official Telegram conversion of the Eternity bot family. It carries a full economy, casino, card-collection, and turn-based Pokémon battle stack — all backed by SQLite and a clean command-loader architecture.

---

## ✨ Features

### 💰 Economy
- Aurites (mana) wallet, moonstones, treasury
- Transfer / daily / weekly / yearly / bonus tracking
- Hardened Markdown-safe transfer command (no more "can't parse entities" crashes)

### 🎰 Casino
- **`.slot <amount>`** — 3×3 weighted slot machine with a 0.05% MEGA JACKPOT, luck-potion save mechanic
- **`.mine <left|center|right> <amount>`** — three-tunnel 50/50 game (1.25× payout)
- **`.egg <amount>`** — egg gacha (5% jackpot / 20% win / 5% tie / 70% loss)

### ⚔️ Pokémon Battles
- **`.challenge <user>`** — open a duel (`--accept`, `--reject`, `--cancel`)
- **`.battle status | fight | switch <n> | forfeit`** — battle controller
- **`.move <number|name>`** — pick a move; auto-resolves a turn when both sides ready
- Built-in 18-type Pokémon type chart with strong/weak/immune multipliers
- Classic damage formula with 6.25% crit chance + 0.85–1.0 variance
- Auto-switch to the next alive party member on faint
- Awards EXP + 100 aurites + win/loss tracking via `pokemonManager`

### 🎴 Card System
- **`.getcard <id>`** — pulls a card from the Eternity API into deck (or collection if deck is full)
- **`.addcard <Deck|Collection> <JSON>`** — owner inject for cards (single object or array)
- 12-card deck limit, full sale / trade / auction subsystem in `cardManager`

### 🛡️ Moderation & Dev
- **`.ban` / `.unban`** — Telegram-native ban with reply / @user / numeric-ID targeting
- **`.warn <reason>`** — 3-strike auto-ban with JSON-backed warn store
- **`.removewarn`** — clears all warnings for a user in the current chat
- **`.addmana <amount> [@user | reply | user_id]`** — owner can mention, reply, or reply-to-self
- **`.addms` / `.removems`** — moonstone management
- All dev commands respect `OWNER_ID` / `MODS` from `.env`

---

## 🚀 Quick Start

### 1. Clone & install
```bash
git clone https://github.com/<your-org>/zerotwo-telegram-bot.git
cd zerotwo-telegram-bot
npm install
```

### 2. Configure `.env`
Create a `.env` file in the project root:

```env
TG_BOT_TOKEN=123456789:AA...             # from @BotFather
OWNER_ID=7998469369                       # your Telegram numeric ID
MODS=                                     # comma-separated mod IDs (optional)
PREFIX=.
```

### 3. Run
```bash
npm start          # production
npm run dev        # auto-restart on file changes
```

> The bot polls for messages by default. No external host or webhook required.

---

## 🧠 Architecture

```
zerotwo-telegram-bot/
├── bot.js                              # entry point
├── package.json
├── README.md
├── .env
└── src/
    ├── adapters/
    │   └── telegram/
    │       ├── TelegramClient.js       # wraps node-telegram-bot-api
    │       └── MessageHandler.js       # loads commands, parses messages
    ├── core/
    │   └── permissions.js              # isOwner / isMod / isStaff helpers
    ├── Database/
    │   ├── econManager.js              # aurites / moonstones / treasury (SQLite)
    │   ├── pokemonManager.js           # party, EXP, wins/losses, companion
    │   ├── cardManager.js              # cards, decks, trades, auctions, sales
    │   ├── afkManager.js
    │   └── warnStore.js                # JSON-backed warning records
    ├── Helpers/
    │   └── pokemonStats.js             # stat formulas, type/sprite lookup
    └── Commands/
        ├── Economy/                    # transfer, balance, daily, ...
        ├── Casino/
        │   ├── slot.js
        │   ├── mine.js
        │   └── egg.js
        ├── Pokemon/
        │   ├── challenge.js
        │   ├── battle.js
        │   ├── battlecore.js
        │   └── move.js
        └── Dev/
            ├── ban.js   unban.js
            ├── addmana.js   addms.js   removems.js
            ├── warn.js   removewarn.js
            ├── Getcard.js   Addcard.js
            └── ...
```

### Command contract
Every file in `src/Commands/<Category>/<name>.js` exports:

```js
module.exports = {
    name: 'mycmd',
    aliases: ['alias1', 'alias2'],
    category: 'economy' | 'casino' | 'pokemon' | 'dev' | ...,
    exp: 0,
    cool: 3,
    react: '✨',
    usage: '.mycmd <arg>',
    description: 'What this command does',
    async execute(client, arg, M) {
        // client.sendMessage(M.chat.id, text, { parse_mode: 'Markdown', reply_to_message_id: M.message_id })
    }
};
```

The `MessageHandler` auto-loads every file under `src/Commands/*/*.js` at boot. Owner-only categories (`dev`) are gated by `OWNER_ID` / mod allowlist in `core/permissions.js`.

---

## 🎯 Highlight: `.addmana` (owner reply-to-self)

The most-requested feature in this build — `addmana` accepts **four** target modes:

| Mode | Example | Behaviour |
|------|---------|-----------|
| Reply to other user | `.addmana 5000` (as reply) | Adds 5,000 mana to the replied user |
| Reply to **yourself** (owner) | `.addmana 300000` (as reply to your own msg) | Adds 300,000 mana to **owner** |
| Mention | `.addmana 598 @user` | Adds 598 mana to `@user` |
| Numeric ID | `.addmana 1000 123456789` | Adds 1,000 mana by user ID |
| No target | `.addmana 300000` | Adds to owner who ran the command |

Permission: **owner only** (`OWNER_ID` from `.env`).

---

## 🛠️ Notable Fix in v2.1.0

`transfer.js` was emitting:
```
ETELEGRAM: 400 Bad Request: can't parse entities: Can't find end of the entity starting at byte offset 26
```
…on certain user names containing `_` / `*` / `` ` `` / `[`.

The fix:
- **Expanded `escapeMd()`** to escape every Markdown-significant char.
- New **`safeSend()` wrapper** that catches `can't parse entities` errors and silently retries the same message in **plain text** — so the user always gets a reply, even if formatting fails.

This pattern is now used across all new dev and casino commands.

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `node-telegram-bot-api` | Telegram transport |
| `sqlite3` | All persistent data (economy / cards / pokemon) |
| `axios`, `node-fetch` | API calls (Eternity card API, etc.) |
| `pokenode-ts` | PokéAPI typings & fetch helpers |
| `canvas`, `@napi-rs/canvas`, `sharp` | Image rendering for card / pokemon previews |
| `moment-timezone` | Daily/weekly/yearly window calculations |
| `dotenv` | Config loading |
| `parse-ms` | Cooldown formatting |

---

## 🤝 Credits

- **Bot:** ZeroTwo
- **Organization:** ETERNITY BOTS
- **Owner / Maintainer:** sano.senxpai

If you fork ZeroTwo, please keep the credits intact. PRs welcome.

---

## 📄 License

See `LICENSE.md`.
