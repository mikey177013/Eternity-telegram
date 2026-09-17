
# Nagatele Bot

> A modular, multi-purpose Telegram bot featuring AI, media tools, moderation, Pokémon battles, fun commands, and more.

Nagatele is a feature-rich Telegram bot built with Node.js. It uses a clean command-loader architecture, SQLite for persistence, and supports a wide range of utilities — from AI chat and media downloads to Pokémon duels and group management.

---

## ✨ Features

### 🤖 AI
- **`.chat`** — conversational AI
- **`.grok`** — Grok AI integration
- **`.aimage`** — AI image generation

### 🎮 Pokémon
- **`.challenge`**, **`.battle`**, **`.move`** — turn-based duels
- **`.catch`**, **`.party`**, **`.dex`**, **`.heal`**, **`.swap`** — manage your Pokémon
- **`.pstart`**, **`.pstats`**, **`.pss`** — starter selection and stats
- Full type chart, damage formula, EXP and win/loss tracking

### 🛡️ Moderation
- **`.ban`**, **`.unban`**, **`.mute`**, **`.unmute`**
- **`.warn`**, **`.removewarn`**, **`.totalwarn`** — 3-strike auto-ban system
- **`.promote`**, **`.demote`**, **`.tagall`**, **`.link`**
- **`.setwelcome`**, **`.setgoodbye`** — customizable greetings

### 🎵 Media
- **`.play`**, **`.spotify`**, **`.spotifyplay`**, **`.yta`**, **`.ytv`** — music & video
- **`.tiktok`**, **`.xdl`**, **`.insta`** — social media downloaders
- **`.lyrics`**, **`.genius`**, **`.shazam`** — music recognition & lyrics
- **`.removebg`**, **`.upscale`**, **`.sharpify`** — image tools

### 🎉 Fun & Reaction
- **`.ship`**, **`.gaycheck`**, **`.horny`**, **`.flip`**, **`.pick`**
- **`.truth`**, **`.dare`** — truth or dare
- Over 25 reaction commands: **`.hug`**, **`.slap`**, **`.pat`**, **`.kiss`**, **`.dance`**, etc.

### 👥 Group & Core
- **`.rank`**, **`.leaderboard`**, **`.profile`**, **`.ping`**
- **`.help`**, **`.rules`**, **`.report`**, **`.support`**
- **`.afk`**, **`.bio`**, **`.id`**, **`.info`**

### 🧩 Utilities & Weeb
- **`.sticker`**, **`.steal`**, **`.quotly`**, **`.getsticker`**
- **`.anime`**, **`.manga`**, **`.character`**, **`.waifu`**, **`.neko`**

### 💞 Relationships
- **`.irlpropose`**, **`.irlaccept`**, **`.irlbreakup`**
- **`.partnerof`**, **`.topcoupels`**

---

## 🚀 Quick Start

### 1. Clone & install
```bash
git clone https://github.com/<your-org>/Nagatele-bot.git
cd Nagatele-bot
npm install
```

### 2. Configure .env

Create a .env file in the project root:

```env
TG_BOT_TOKEN=123456789:AA...             # from @BotFather
OWNER_ID=7998469369                       # your Telegram numeric ID
MODS=                                     # comma-separated mod IDs (optional)
PREFIX=.
```

### 3. Run

```bash
npm start          # production
npm run dev        # auto-restart on file changes (if configured)
```

The bot uses long polling by default. No webhook or external host required.

---

🧠 Architecture

```
Nagatele-master/
├── bot.js                              # entry point
├── ecosystem.config.js                 # PM2 config (optional)
├── package.json
├── .env
├── assets/
│   └── images/                         # static images for cards, UI, etc.
└── src/
    ├── Commands/
    │   ├── Ai/                         # AI chat, image gen
    │   ├── Core/                       # basic commands (help, ping, profile…)
    │   ├── Dev/                        # owner-only dev tools
    │   ├── Fun/                        # games & entertainment
    │   ├── GroupChat/                  # group stats & leaderboards
    │   ├── Media/                      # downloaders & music
    │   ├── Moderation/                 # ban, mute, warn, welcome
    │   ├── Pokemon/                    # battle system & management
    │   ├── Reaction/                   # anime reaction GIFs
    │   ├── Relation/                   # relationship commands
    │   ├── Utils/                      # sticker, image, upload tools
    │   └── Weeb/                       # anime/manga/waifu
    ├── Database/
    │   ├── afkManager.js
    │   ├── chatfightManager.js
    │   ├── pokemonManager.js
    │   ├── setup.js
    │   └── warnStore.js
    ├── Handlers/
    │   ├── AutoDownloader.js
    │   ├── ChatFightHandler.js
    │   ├── Clan.js
    │   ├── Events.js
    │   ├── Mods.js
    │   ├── WelcomeHandler.js
    │   ├── poke.js
    │   └── pokemonGame.js
    ├── Helpers/
    │   ├── CardGenerator.js
    │   ├── QuoteGenerator.js
    │   ├── Stats.js
    │   ├── mention.js
    │   ├── normalize.js
    │   └── pokemonStats.js
    ├── Structures/
    │   ├── Contact.js
    │   ├── Functions.js
    │   └── TGClient.js
    ├── adapters/
    │   └── telegram/
    │       ├── Context.js
    │       ├── MessageHandler.js
    │       ├── Middleware.js
    │       ├── Parser.js
    │       └── TelegramClient.js
    ├── core/
    │   ├── commandRouter.js
    │   ├── cooldowns.js
    │   └── permissions.js
    └── lib/
        ├── upload.js
        ├── uploadd.js
        └── utils.js
```

Command contract

Every file in src/Commands/<Category>/<name>.js exports:

```js
module.exports = {
    name: 'mycmd',
    aliases: ['alias1', 'alias2'],
    category: 'fun' | 'media' | 'pokemon' | 'dev' | ...,
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

The MessageHandler auto-loads every file under src/Commands/*/*.js at boot. Owner-only categories (dev) are gated by OWNER_ID / mod allowlist in core/permissions.js.

---

##📦 Dependencies

Package Purpose
node-telegram-bot-api Telegram transport
sqlite3 Persistent data (Pokémon, warnings, AFK, etc.)
axios, node-fetch API calls
pokenode-ts PokéAPI typings & fetch helpers
canvas, @napi-rs/canvas, sharp Image rendering for cards & previews
moment-timezone Time-based commands
dotenv Config loading
parse-ms Cooldown formatting

---

##🧪 Testing

Two smoke-test scripts are included:

```bash
node test-chatfight.js     # tests chat fight handler
node test-smoke-load.js    # verifies all commands load without errors
```

Run these after making changes to ensure nothing is broken.

---

##🤝 Credits

· Bot: Nagatele
· Organization: ETERNITY BOTS
· Owner / Maintainer: sano.senxpai

If you fork this project, please keep the credits intact. PRs are welcome.

---

##📄 License

See LICENSE for details.

```