// src/Commands/Media/genius.js
// Song lyrics finder using Genius API
// Adapted from genius-js.js (ZennzXD)
const axios = require('axios');

const GENIUS_HEADERS = {
    'Accept-Encoding': 'gzip',
    'x-genius-app-background-request': '0',
    'x-genius-logged-out': 'true',
    'x-genius-android-version': '8.1.1',
    'user-agent': 'Genius/8.1.1 (Android; Android 13; ZN/Android)'
};

function parselirik(node) {
    if (typeof node === 'string') return node;
    if (!node || !node.children) return '';
    if (node.tag === 'br') return '\n';
    return node.children.map(parselirik).join('');
}

async function detail(id) {
    const res = await axios.get(`https://api.genius.com/songs/${id}`, {
        headers: GENIUS_HEADERS,
        timeout: 20000
    });
    const song = res.data?.response?.song;
    if (!song) throw new Error('Song not found');

    return {
        id: song.id,
        title: song.title,
        artist: song.artist_names,
        header_image_url: song.header_image_url,
        song_art_image_url: song.song_art_image_url,
        release_date: song.release_date_for_display,
        url: song.url,
        lyrics: song.lyrics ? parselirik(song.lyrics.dom).trim() : null
    };
}

async function search(query) {
    const res = await axios.get(
        `https://api.genius.com/search/multi?q=${encodeURIComponent(query)}`,
        { headers: GENIUS_HEADERS, timeout: 20000 }
    );

    const songs = [];
    const sections = res.data?.response?.sections || [];

    for (const section of sections) {
        if (section.type === 'song' || section.type === 'top_hit') {
            for (const hit of section.hits || []) {
                if (hit.type === 'song') {
                    const song = hit.result;
                    songs.push({
                        id: song.id,
                        title: song.title,
                        artist: song.artist_names,
                        header_image_url: song.header_image_url,
                        url: song.url
                    });
                }
            }
        }
    }

    return songs;
}

// Markdown-safe escape
const escMd = (s) => String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');

module.exports = {
    name: 'genius',
    aliases: ['lyric', 'lyrics', 'songlyrics'],
    category: 'media',
    exp: 5,
    cool: 8,
    react: '🎶',
    description: 'Find song lyrics via Genius',
    usage: '.genius <song name or "artist - title">',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const query = (arg || '').trim();

        if (!query) {
            return client.sendMessage(chatId,
                '🎶 *Genius Lyrics*\n\nUsage: `.genius <song name>`\nExample: `.genius bohemian rhapsody`',
                { parse_mode: 'Markdown' }
            );
        }

        let status;
        try {
            status = await client.sendMessage(chatId, `🔎 Searching lyrics for "${query}"...`);
        } catch (_) {}

        try {
            const results = await search(query);
            if (!results.length) {
                if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
                return client.sendMessage(chatId, '❌ No results found on Genius.', { parse_mode: 'Markdown' });
            }

            const first = results[0];
            const full = await detail(first.id);

            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }

            // Header card
            const header =
                `🎶 *${escMd(full.title)}*\n` +
                `🎤 ${escMd(full.artist)}\n` +
                (full.release_date ? `📅 ${escMd(full.release_date)}\n` : '') +
                `🔗 ${full.url}`;

            try {
                if (full.song_art_image_url || full.header_image_url) {
                    await client.sendPhoto(chatId, full.song_art_image_url || full.header_image_url, {
                        caption: header,
                        parse_mode: 'Markdown'
                    });
                } else {
                    await client.sendMessage(chatId, header, { parse_mode: 'Markdown' });
                }
            } catch (_) {
                await client.sendMessage(chatId, header, { parse_mode: 'Markdown' });
            }

            const lyrics = (full.lyrics || '').trim();
            if (!lyrics) {
                return client.sendMessage(chatId,
                    `⚠️ Lyrics not embedded by Genius for this track. Open: ${full.url}`,
                    { parse_mode: 'Markdown', disable_web_page_preview: false }
                );
            }

            // Telegram message limit ~4096 chars; chunk safely under 3500
            const CHUNK = 3500;
            for (let i = 0; i < lyrics.length; i += CHUNK) {
                const part = lyrics.slice(i, i + CHUNK);
                // Send as plain text (no parse_mode) to avoid entity parse errors in lyrics
                await client.sendMessage(chatId, part, { parse_mode: undefined, disable_web_page_preview: true });
            }

        } catch (err) {
            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
            console.error('Genius error:', err.message);
            await client.sendMessage(chatId, `❌ Failed to fetch lyrics: ${err.message}`, { parse_mode: 'Markdown' });
        }
    },

    _search: search,
    _detail: detail
};
