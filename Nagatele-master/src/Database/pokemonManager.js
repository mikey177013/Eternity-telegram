// src/Database/pokemonManager.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

class PokemonManager {
  constructor() {
    this.dbPath = path.join(__dirname, "pkmn.sqlite");
    this.db = new sqlite3.Database(this.dbPath);

    // ✅ PARTY LIMIT = 6
    this.PARTY_LIMIT = 6;

    this.init();
  }

  init() {
    this.db.serialize(() => {
      // ================= TRAINERS =================
      this.db.run(`
        CREATE TABLE IF NOT EXISTS trainers (
          userId TEXT PRIMARY KEY,
          exp INTEGER DEFAULT 0,
          level INTEGER DEFAULT 1,
          wins INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          coins INTEGER DEFAULT 0,
          startedAt INTEGER DEFAULT 0
        )
      `);

      // ================= COMPANION =================
      this.db.run(`
        CREATE TABLE IF NOT EXISTS companion (
          userId TEXT PRIMARY KEY,
          pokemonName TEXT
        )
      `);

      // ================= PARTY =================
      this.db.run(`
        CREATE TABLE IF NOT EXISTS party (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT,
          pid INTEGER,
          name TEXT,
          level INTEGER DEFAULT 1,
          exp INTEGER DEFAULT 0,

          hp INTEGER DEFAULT 50,
          attack INTEGER DEFAULT 10,
          defense INTEGER DEFAULT 10,
          speed INTEGER DEFAULT 10,

          maxHp INTEGER DEFAULT 50,
          maxAttack INTEGER DEFAULT 10,
          maxDefense INTEGER DEFAULT 10,
          maxSpeed INTEGER DEFAULT 10,

          image TEXT,
          types TEXT, -- JSON
          moves TEXT, -- JSON

          rarity TEXT DEFAULT 'common',
          female INTEGER DEFAULT 0,
          tag TEXT DEFAULT '0',

          region TEXT DEFAULT 'wild',
          regionalIndex INTEGER DEFAULT 0,

          isActive INTEGER DEFAULT 0
        )
      `);

      // ================= INVENTORY =================
      this.db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
          userId TEXT PRIMARY KEY,
          pokeball INTEGER DEFAULT 10,
          greatball INTEGER DEFAULT 2,
          ultraball INTEGER DEFAULT 0,
          potion INTEGER DEFAULT 3,
          superpotion INTEGER DEFAULT 0,
          reviver INTEGER DEFAULT 0
        )
      `);

      // ================= WILD SPAWNS =================
      this.db.run(`
        CREATE TABLE IF NOT EXISTS wild_spawns (
          chatId TEXT PRIMARY KEY,
          pid INTEGER,
          name TEXT,
          rarity TEXT,
          level INTEGER,

          hp INTEGER,
          attack INTEGER,
          defense INTEGER,
          speed INTEGER,

          image TEXT,
          types TEXT, -- JSON
          spawnedAt INTEGER,
          expiresAt INTEGER
        )
      `);

      // ================= PSS STORAGE (BOX) =================
      this.db.run(`
        CREATE TABLE IF NOT EXISTS pss (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId TEXT,
          pid INTEGER,
          name TEXT,
          level INTEGER DEFAULT 1,
          exp INTEGER DEFAULT 0,

          hp INTEGER DEFAULT 50,
          attack INTEGER DEFAULT 10,
          defense INTEGER DEFAULT 10,
          speed INTEGER DEFAULT 10,

          maxHp INTEGER DEFAULT 50,
          maxAttack INTEGER DEFAULT 10,
          maxDefense INTEGER DEFAULT 10,
          maxSpeed INTEGER DEFAULT 10,

          image TEXT,
          types TEXT, -- JSON
          moves TEXT, -- JSON

          rarity TEXT DEFAULT 'common',
          female INTEGER DEFAULT 0,
          tag TEXT DEFAULT '0',

          region TEXT DEFAULT 'wild',
          regionalIndex INTEGER DEFAULT 0,

          storedAt INTEGER DEFAULT 0
        )
      `);
    });
  }

  // =====================================================
  // JSON HELPERS
  // =====================================================
  _jsonParse(str, fallback = []) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  _jsonStringify(val) {
    try {
      return JSON.stringify(val ?? []);
    } catch {
      return "[]";
    }
  }

  // =====================================================
  // USER INIT
  // =====================================================
  async ensureUser(userId) {
    return new Promise((resolve) => {
      this.db.run(`INSERT OR IGNORE INTO trainers(userId, startedAt) VALUES(?, ?)`, [
        userId,
        Date.now(),
      ]);
      this.db.run(`INSERT OR IGNORE INTO inventory(userId) VALUES(?)`, [userId]);
      resolve(true);
    });
  }

  // =====================================================
  // TRAINER
  // =====================================================
  getTrainer(userId) {
    return new Promise((resolve) => {
      this.db.get(`SELECT * FROM trainers WHERE userId=?`, [userId], (err, row) => {
        if (err) return resolve(null);
        resolve(row || null);
      });
    });
  }

  setTrainer(userId, data) {
    return new Promise((resolve) => {
      this.db.run(
        `UPDATE trainers SET exp=?, level=?, wins=?, losses=?, coins=? WHERE userId=?`,
        [data.exp, data.level, data.wins, data.losses, data.coins, userId],
        () => resolve(true)
      );
    });
  }

  async addTrainerExp(userId, expGain, getLevelFromExp) {
    await this.ensureUser(userId);

    const t = (await this.getTrainer(userId)) || {
      exp: 0,
      level: 1,
      wins: 0,
      losses: 0,
      coins: 0,
    };

    t.exp += Number(expGain) || 0;
    t.level = typeof getLevelFromExp === "function" ? getLevelFromExp(t.exp) : t.level;

    await this.setTrainer(userId, t);
    return t;
  }

  async addCoins(userId, amount) {
    await this.ensureUser(userId);

    const t = await this.getTrainer(userId);
    if (!t) return null;

    t.coins = Math.max(0, (t.coins || 0) + Number(amount || 0));
    await this.setTrainer(userId, t);
    return t;
  }

  async addWin(userId) {
    await this.ensureUser(userId);
    const t = await this.getTrainer(userId);
    if (!t) return null;
    t.wins = (t.wins || 0) + 1;
    await this.setTrainer(userId, t);
    return t;
  }

  async addLoss(userId) {
    await this.ensureUser(userId);
    const t = await this.getTrainer(userId);
    if (!t) return null;
    t.losses = (t.losses || 0) + 1;
    await this.setTrainer(userId, t);
    return t;
  }

  // =====================================================
  // COMPANION
  // =====================================================
  getCompanion(userId) {
    return new Promise((resolve) => {
      this.db.get(`SELECT * FROM companion WHERE userId=?`, [userId], (err, row) => {
        if (err) return resolve(null);
        resolve(row?.pokemonName || null);
      });
    });
  }

  setCompanion(userId, pokemonName) {
    return new Promise((resolve) => {
      this.db.run(
        `INSERT OR REPLACE INTO companion(userId, pokemonName) VALUES(?, ?)`,
        [userId, pokemonName],
        () => resolve(true)
      );
    });
  }

  // =====================================================
  // PARTY LIMIT
  // =====================================================
  getPartyCount(userId) {
    return new Promise((resolve) => {
      this.db.get(
        `SELECT COUNT(*) as total FROM party WHERE userId=?`,
        [userId],
        (err, row) => {
          if (err) return resolve(0);
          resolve(Number(row?.total || 0));
        }
      );
    });
  }

  // =====================================================
  // PARTY
  // =====================================================
  listParty(userId) {
    return new Promise((resolve) => {
      this.db.all(
        `SELECT * FROM party WHERE userId=? ORDER BY isActive DESC, level DESC, id DESC`,
        [userId],
        (err, rows) => {
          if (err) return resolve([]);
          const parsed = (rows || []).map((r) => ({
            ...r,
            types: this._jsonParse(r.types, []),
            moves: this._jsonParse(r.moves, []),
            female: Boolean(r.female),
            isActive: Boolean(r.isActive),
          }));
          resolve(parsed);
        }
      );
    });
  }

  getPokemonById(userId, pokeId) {
    return new Promise((resolve) => {
      this.db.get(
        `SELECT * FROM party WHERE userId=? AND id=?`,
        [userId, pokeId],
        (err, row) => {
          if (err) return resolve(null);
          if (!row) return resolve(null);

          resolve({
            ...row,
            types: this._jsonParse(row.types, []),
            moves: this._jsonParse(row.moves, []),
            female: Boolean(row.female),
            isActive: Boolean(row.isActive),
          });
        }
      );
    });
  }

  getActivePokemon(userId) {
    return new Promise((resolve) => {
      this.db.get(
        `SELECT * FROM party WHERE userId=? AND isActive=1`,
        [userId],
        (err, row) => {
          if (err) return resolve(null);
          if (!row) return resolve(null);

          resolve({
            ...row,
            types: this._jsonParse(row.types, []),
            moves: this._jsonParse(row.moves, []),
            female: Boolean(row.female),
            isActive: Boolean(row.isActive),
          });
        }
      );
    });
  }

  // ✅ PARTY LIMIT ENFORCED
  async addPokemonToParty(userId, pokemonData) {
    const count = await this.getPartyCount(userId);
    if (count >= this.PARTY_LIMIT) {
      return { ok: false, full: true, message: "Party is full (max 6 Pokémon)." };
    }

    return new Promise((resolve) => {
      const types = this._jsonStringify(pokemonData.types || []);
      const moves = this._jsonStringify(pokemonData.moves || []);

      this.db.run(
        `INSERT INTO party
          (userId, pid, name, level, exp, hp, attack, defense, speed, maxHp, maxAttack, maxDefense, maxSpeed,
           image, types, moves, rarity, female, tag, region, regionalIndex, isActive)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          userId,
          pokemonData.pid,
          pokemonData.name,
          pokemonData.level || 1,
          pokemonData.exp || 0,

          pokemonData.hp || 50,
          pokemonData.attack || 10,
          pokemonData.defense || 10,
          pokemonData.speed || 10,

          pokemonData.maxHp || pokemonData.hp || 50,
          pokemonData.maxAttack || pokemonData.attack || 10,
          pokemonData.maxDefense || pokemonData.defense || 10,
          pokemonData.maxSpeed || pokemonData.speed || 10,

          pokemonData.image || null,
          types,
          moves,

          pokemonData.rarity || "common",
          pokemonData.female ? 1 : 0,
          pokemonData.tag || "0",

          pokemonData.region || "wild",
          pokemonData.regionalIndex || 0,

          pokemonData.isActive ? 1 : 0,
        ],
        function () {
          resolve({ ok: true, id: this.lastID });
        }
      );
    });
  }

  setActivePokemon(userId, pokeId) {
    return new Promise((resolve) => {
      this.db.run(`UPDATE party SET isActive=0 WHERE userId=?`, [userId], () => {
        this.db.run(
          `UPDATE party SET isActive=1 WHERE userId=? AND id=?`,
          [userId, pokeId],
          () => resolve(true)
        );
      });
    });
  }

  deletePartyPokemon(userId, pokeId) {
    return new Promise((resolve) => {
      this.db.run(
        `DELETE FROM party WHERE userId=? AND id=?`,
        [userId, pokeId],
        function () { resolve(this.changes > 0); }
      );
    });
  }

  healAllParty(userId) {
    return new Promise((resolve) => {
      this.db.run(
        `UPDATE party SET hp=maxHp WHERE userId=?`,
        [userId],
        function () { resolve(this.changes); }
      );
    });
  }

  updatePokemon(userId, pokeId, updates = {}) {
    const allowed = [
      "hp",
      "attack",
      "defense",
      "speed",
      "maxHp",
      "maxAttack",
      "maxDefense",
      "maxSpeed",
      "level",
      "exp",
      "moves",
      "types",
      "isActive",
    ];

    const keys = Object.keys(updates).filter((k) => allowed.includes(k));
    if (!keys.length) return Promise.resolve(false);

    if (keys.includes("moves") && typeof updates.moves !== "string") {
      updates.moves = this._jsonStringify(updates.moves);
    }
    if (keys.includes("types") && typeof updates.types !== "string") {
      updates.types = this._jsonStringify(updates.types);
    }

    const setSQL = keys.map((k) => `${k}=?`).join(", ");
    const values = keys.map((k) => updates[k]);

    return new Promise((resolve) => {
      this.db.run(
        `UPDATE party SET ${setSQL} WHERE userId=? AND id=?`,
        [...values, userId, pokeId],
        () => resolve(true)
      );
    });
  }

  // =====================================================
  // PSS (BOX STORAGE)
  // =====================================================
  addPokemonToPSS(userId, pokemonData) {
    return new Promise((resolve) => {
      const types = this._jsonStringify(pokemonData.types || []);
      const moves = this._jsonStringify(pokemonData.moves || []);

      this.db.run(
        `INSERT INTO pss
        (userId, pid, name, level, exp, hp, attack, defense, speed, maxHp, maxAttack, maxDefense, maxSpeed,
        image, types, moves, rarity, female, tag, region, regionalIndex, storedAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          userId,
          pokemonData.pid,
          pokemonData.name,
          pokemonData.level || 1,
          pokemonData.exp || 0,

          pokemonData.hp || 50,
          pokemonData.attack || 10,
          pokemonData.defense || 10,
          pokemonData.speed || 10,

          pokemonData.maxHp || pokemonData.hp || 50,
          pokemonData.maxAttack || pokemonData.attack || 10,
          pokemonData.maxDefense || pokemonData.defense || 10,
          pokemonData.maxSpeed || pokemonData.speed || 10,

          pokemonData.image || null,
          types,
          moves,

          pokemonData.rarity || "common",
          pokemonData.female ? 1 : 0,
          pokemonData.tag || "0",

          pokemonData.region || "wild",
          pokemonData.regionalIndex || 0,

          Date.now(),
        ],
        function () {
          resolve({ ok: true, id: this.lastID });
        }
      );
    });
  }

  listPSS(userId) {
    return new Promise((resolve) => {
      this.db.all(`SELECT * FROM pss WHERE userId=? ORDER BY id DESC`, [userId], (err, rows) => {
        if (err) return resolve([]);
        const parsed = (rows || []).map((r) => ({
          ...r,
          types: this._jsonParse(r.types, []),
          moves: this._jsonParse(r.moves, []),
          female: Boolean(r.female),
        }));
        resolve(parsed);
      });
    });
  }

  getPSSPokemon(userId, pssId) {
    return new Promise((resolve) => {
      this.db.get(`SELECT * FROM pss WHERE userId=? AND id=?`, [userId, pssId], (err, row) => {
        if (err) return resolve(null);
        if (!row) return resolve(null);

        resolve({
          ...row,
          types: this._jsonParse(row.types, []),
          moves: this._jsonParse(row.moves, []),
          female: Boolean(row.female),
        });
      });
    });
  }

  deletePSSPokemon(userId, pssId) {
    return new Promise((resolve) => {
      this.db.run(`DELETE FROM pss WHERE userId=? AND id=?`, [userId, pssId], () => resolve(true));
    });
  }

  // =====================================================
  // INVENTORY
  // =====================================================
  getInventory(userId) {
    return new Promise((resolve) => {
      this.db.get(`SELECT * FROM inventory WHERE userId=?`, [userId], (err, row) => {
        if (err) return resolve(null);
        resolve(row || null);
      });
    });
  }

  addItem(userId, item, qty = 1) {
    return new Promise((resolve) => {
      this.db.run(`UPDATE inventory SET ${item} = ${item} + ? WHERE userId=?`, [qty, userId], () =>
        resolve(true)
      );
    });
  }

  consumeItem(userId, item, qty = 1) {
    return new Promise((resolve) => {
      this.db.run(
        `UPDATE inventory
         SET ${item} = CASE WHEN ${item}>=? THEN ${item}-? ELSE ${item} END
         WHERE userId=?`,
        [qty, qty, userId],
        () => resolve(true)
      );
    });
  }

  // =====================================================
  // WILD SPAWNS
  // =====================================================
  saveWildSpawn(chatId, spawn) {
    return new Promise((resolve) => {
      this.db.run(
        `INSERT OR REPLACE INTO wild_spawns
         (chatId, pid, name, rarity, level, hp, attack, defense, speed, image, types, spawnedAt, expiresAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          chatId,
          spawn.pid,
          spawn.name,
          spawn.rarity,
          spawn.level,

          spawn.hp,
          spawn.attack,
          spawn.defense,
          spawn.speed,

          spawn.image,
          this._jsonStringify(spawn.types || []),
          spawn.spawnedAt || Date.now(),
          spawn.expiresAt || Date.now() + 8 * 60 * 1000,
        ],
        () => resolve(true)
      );
    });
  }

  getWildSpawn(chatId) {
    return new Promise((resolve) => {
      this.db.get(`SELECT * FROM wild_spawns WHERE chatId=?`, [chatId], (err, row) => {
        if (err) return resolve(null);
        if (!row) return resolve(null);
        resolve({ ...row, types: this._jsonParse(row.types, []) });
      });
    });
  }

  clearWildSpawn(chatId) {
    return new Promise((resolve) => {
      this.db.run(`DELETE FROM wild_spawns WHERE chatId=?`, [chatId], () => resolve(true));
    });
  }
}

module.exports = new PokemonManager();