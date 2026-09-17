// src/Commands/Media/spotifyplay.js
// Search a song name on Spotify and play (download via spotmate)
// Adapted from spotify-play2.js (ZennzXD)
const axios = require('axios');
const { _spdl } = require('./spotmate');

const escMd = (s) => String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');

function fmtMs(milliseconds) {
    const totalSeconds = Math.floor((milliseconds || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Search using a public Spotify search API (fallback chain).
 * Returns { name, artist, duration_ms, url, cover }
 */
async function searchSpotify(query) {
    const endpoints = [
        async () => {
            const r = await axios.get(
                `https://apis.prexzyvilla.site/search/spotify?query=${encodeURIComponent(query)}`,
                { timeout: 7000 }
            );
            const songs = r.data?.songs || r.data?.results || [];
            const s = songs[0];
            if (!s) return null;
            return {
                name: s.title || s.name,
                artist: s.artist || (s.artists && s.artists.map(a => a.name || a).join(', ')),
                duration_ms: s.duration_ms || 0,
                url: s.url || s.spotify_url || s.external_url,
                cover: s.image || s.thumbnail || null
            };
        },
        async () => {
            const r = await axios.get(
                `https://api.apocalypse.web.id/search/spotify?q=${encodeURIComponent(query)}`,
                { timeout: 7000 }
            );
            const songs = r.data?.songs || r.data?.results || [];
            const s = songs[0];
            if (!s) return null;
            return {
                name: s.title || s.name,
                artist: s.artist || (s.artists && s.artists.map(a => a.name || a).join(', ')),
                duration_ms: s.duration_ms || 0,
                url: s.url || s.spotify_url || s.external_url,
                cover: s.image || s.thumbnail || null
            };
        }
    ];
    for (const fn of endpoints) {
        try {
            const out = await fn();
            if (out && out.url) return out;
        } catch (_) { /* try next */ }
    }
    return null;
}

module.exports = {
    name: 'spotifyplay',
    aliases: ['spplay', 'spsong'],
    category: 'media',
    exp: 5,
    cool: 10,
    react: '🎼',
    description: 'Search a song name and play it via Spotify',
    usage: '.spotifyplay <song name>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const query = (arg || '').trim();
        if (!query) {
            return client.sendMessage(chatId,
                '🎼 *Spotify Play*\n\nUsage: `.spotifyplay <song name>`',
                { parse_mode: 'Markdown' }
            );
        }

        let status;
        try { status = await client.sendMessage(chatId, `🔎 Searching Spotify for "${query}"...`); } catch (_) {}

        try {
            const track = await searchSpotify(query);
            if (!track || !track.url) {
                if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
                return client.sendMessage(chatId, '❌ No Spotify match found.');
            }

            const result = await _spdl(track.url);

            const caption =
                `🎧 *${escMd(track.name)}*\n` +
                `🎤 ${escMd(track.artist || 'Unknown')}\n` +
                (track.duration_ms ? `⏱️ ${fmtMs(track.duration_ms)}\n` : '') +
                `🔗 ${track.url}`;

            // Get audio
            const audioRes = await axios.get(result.download, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            const audioBuffer = Buffer.from(audioRes.data);

            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }

            if (track.cover || result.metadata?.cover) {
                try {
                    await client.sendPhoto(chatId, track.cover || result.metadata.cover, {
                        caption, parse_mode: 'Markdown'
                    });
                } catch (_) {
                    await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
                }
            } else {
                await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
            }

            try {
                await client.sendAudio(chatId, audioBuffer, {
                    title: track.name,
                    performer: track.artist || 'Unknown',
                    filename: `${(track.name || 'track').replace(/[^\w\s.-]/g, '')}.mp3`
                });
            } catch (_) {
                await client.sendDocument(chatId, audioBuffer, {
                    filename: `${(track.name || 'track').replace(/[^\w\s.-]/g, '')}.mp3`,
                    contentType: 'audio/mpeg'
                });
            }
        } catch (err) {
            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
            console.error('SpotifyPlay error:', err.message);
            await client.sendMessage(chatId,
                `❌ Failed: ${err.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    }
};
