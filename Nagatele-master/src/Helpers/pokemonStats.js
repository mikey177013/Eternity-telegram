// src/Helpers/pokemonStats.js
// Self-contained stat calculator for wild pokemon (no external client.utils needed).
const axios = require('axios');

const _cache = new Map();

async function fetchPokemonData(pid) {
  if (_cache.has(pid)) return _cache.get(pid);
  try {
    const { data } = await axios.get(`https://pokeapi.co/api/v2/pokemon/${pid}`, { timeout: 15000 });
    _cache.set(pid, data);
    return data;
  } catch (_) {
    return null;
  }
}

function baseStat(data, name) {
  if (!data?.stats) return 50;
  const s = data.stats.find((x) => x.stat?.name === name);
  return s ? Number(s.base_stat) : 50;
}

// Approximate Pokemon-style stat at given level (simplified formula).
function calcStat(base, level, isHP = false) {
  const lvl = Math.max(1, Number(level) || 1);
  if (isHP) return Math.floor(((2 * base + 31) * lvl) / 100 + lvl + 10);
  return Math.floor(((2 * base + 31) * lvl) / 100 + 5);
}

async function getPokemonStats(pid, level = 1) {
  const data = await fetchPokemonData(pid);
  if (!data) {
    return { hp: 50, attack: 10, defense: 10, speed: 10 };
  }
  return {
    hp: calcStat(baseStat(data, 'hp'), level, true),
    attack: calcStat(baseStat(data, 'attack'), level),
    defense: calcStat(baseStat(data, 'defense'), level),
    speed: calcStat(baseStat(data, 'speed'), level),
  };
}

function capitalize(s = '') {
  if (!s) return '';
  return String(s).charAt(0).toUpperCase() + String(s).slice(1);
}

module.exports = { getPokemonStats, fetchPokemonData, capitalize };
