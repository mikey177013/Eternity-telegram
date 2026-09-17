// src/Commands/Media/spotmate.js
// Spotify track downloader using spotmate.online
// Adapted from spotmate.js (ZennzXD)
const axios = require('axios');
const qs = require('qs');

async function spdl(url) {
    if (!url || !/sp/i.test(url)) throw new Error('Invalid Spotify URL');

    const req = await axios.get('https://spotmate.online/en1', { timeout: 20000 });
    const html = req.data;
    const csrfMatch = html.match(/<meta[^>]+name="csrf-token"[^>]+content="([^"]+)"/i);
    if (!csrfMatch) throw new Error('Could not retrieve CSRF token from spotmate');
    const token = csrfMatch[1];

    const cookieHeader = (req.headers['set-cookie'] || [])
        .map(v => v.split(';')[0])
        .join('; ');

    const sock = axios.create({
        baseURL: 'https://spotmate.online',
        timeout: 30000,
        headers: {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'x-csrf-token': token,
            'cookie': cookieHeader,
            'x-requested-with': 'XMLHttpRequest',
            'origin': 'https://spotmate.online',
            'referer': 'https://spotmate.online/en1',
            'user-agent': 'Mozilla/5.0'
        }
    });

    const meta = await sock.post('/getTrackData', qs.stringify({ spotify_url: url }));
    const conv = await sock.post('/convert', qs.stringify({ urls: url }));

    const m = meta.data || {};
    const dl = conv.data || {};
    if (!dl.url) throw new Error('Spotmate did not return a download URL');

    return {
        metadata: {
            id: m.id,
            type: m.type,
            name: m.name,
            duration_ms: m.duration_ms,
            artists: m.artists,
            album: m.album,
            url: m.external_urls?.spotify || url,
            cover: m.album?.images?.[0]?.url || null
        },
        download: dl.url
    };
}

function ms(milliseconds) {
    const totalSeconds = Math.floor((milliseconds || 0) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const escMd = (s) => String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');

module.exports = {
    name: 'spotdl',
    aliases: ['spotifydl', 'spdl', 'spotmate'],
    category: 'media',
    exp: 5,
    cool: 10,
    react: '🎧',
    description: 'Download a song from a Spotify track URL',
    usage: '.spotdl <spotify track url>',

    async execute(client, arg, M) {
        const chatId = M.chat.id;
        const urlMatch = (arg || '').match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0].trim() : '';

        if (!url || !/open\.spotify\.com\/track\//i.test(url)) {
            return client.sendMessage(chatId,
                '🎧 *Spotify Downloader*\n\nUsage: `.spotdl <spotify_track_url>`',
                { parse_mode: 'Markdown' }
            );
        }

        let status;
        try { status = await client.sendMessage(chatId, '🎵 Resolving Spotify track...'); } catch (_) {}

        try {
            const result = await spdl(url);
            const meta = result.metadata;
            const artistNames = Array.isArray(meta.artists)
                ? meta.artists.map(a => a.name || a).join(', ')
                : (meta.artists?.name || meta.artists || 'Unknown');

            const caption =
                `🎧 *${escMd(meta.name || 'Track')}*\n` +
                `🎤 ${escMd(artistNames)}\n` +
                (meta.duration_ms ? `⏱️ ${ms(meta.duration_ms)}\n` : '') +
                (meta.album?.name ? `💿 ${escMd(meta.album.name)}\n` : '') +
                `🔗 ${meta.url}`;

            // Download the audio
            const audioRes = await axios.get(result.download, {
                responseType: 'arraybuffer',
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            });
            const audioBuffer = Buffer.from(audioRes.data);

            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }

            // Send cover with caption first
            if (meta.cover) {
                try { await client.sendPhoto(chatId, meta.cover, { caption, parse_mode: 'Markdown' }); }
                catch (_) { await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' }); }
            } else {
                await client.sendMessage(chatId, caption, { parse_mode: 'Markdown' });
            }

            // Send audio
            try {
                await client.sendAudio(chatId, audioBuffer, {
                    title: meta.name || 'Track',
                    performer: artistNames,
                    filename: `${(meta.name || 'track').replace(/[^\w\s.-]/g, '')}.mp3`
                });
            } catch (e) {
                // Fallback: send as document
                await client.sendDocument(chatId, audioBuffer, {
                    filename: `${(meta.name || 'track').replace(/[^\w\s.-]/g, '')}.mp3`,
                    contentType: 'audio/mpeg'
                });
            }
        } catch (err) {
            if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
            console.error('Spotmate error:', err.message);
            await client.sendMessage(chatId,
                `❌ Failed to download Spotify track: ${err.message}`,
                { parse_mode: 'Markdown' }
            );
        }
    },

    _spdl: spdl
};
