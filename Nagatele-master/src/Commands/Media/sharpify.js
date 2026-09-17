// src/Commands/Media/sharpify.js
// Image enhancer plugin (Sharpify API)
// Base : https://play.google.com/store/apps/details?id=com.raahim2.Sharpify
const axios = require('axios');
const FormData = require('form-data');

const SHARPIFY_HEADERS = {
    'User-Agent': 'okhttp/4.9.2',
    'Accept-Encoding': 'gzip'
};

const SHARPIFY_ENDPOINTS = {
    enhance:  'https://sharpify-api.vercel.app/api/enhance/auto_enhance',
    upscale:  'https://sharpify-api.vercel.app/api/enhance/upscale',
    removebg: 'https://sharpify-api.vercel.app/api/enhance/bgrem'
};

/**
 * Sharpify API call - send image buffer, get processed result
 * @param {Buffer} fileBuffer - raw image buffer
 * @param {'enhance'|'upscale'|'removebg'} model
 */
async function sharpify(fileBuffer, model) {
    const endpoint = SHARPIFY_ENDPOINTS[model];
    if (!endpoint) throw new Error(`Unknown model: ${model}`);

    const form = new FormData();
    form.append('file', fileBuffer, { filename: 'source.jpg', contentType: 'image/jpeg' });

    const res = await axios.post(endpoint, form, {
        headers: { ...SHARPIFY_HEADERS, ...form.getHeaders() },
        responseType: 'arraybuffer',
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 90000
    });

    // The API can return either binary image data OR a JSON {url: ...}
    const contentType = (res.headers['content-type'] || '').toLowerCase();
    if (contentType.includes('application/json')) {
        const text = Buffer.from(res.data).toString('utf-8');
        let parsed;
        try { parsed = JSON.parse(text); } catch (_) { parsed = null; }
        if (parsed && (parsed.url || parsed.result || parsed.image)) {
            const url = parsed.url || parsed.result || parsed.image;
            const dl = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
            return Buffer.from(dl.data);
        }
        throw new Error(`Sharpify error: ${text.slice(0, 200)}`);
    }

    return Buffer.from(res.data);
}

/**
 * Download a Telegram photo/document into a Buffer
 */
async function downloadTelegramFile(client, fileId) {
    const file = await client.bot.getFile(fileId);
    if (!file || !file.file_path) throw new Error('Failed to resolve Telegram file');
    const url = `https://api.telegram.org/file/bot${client.bot.token}/${file.file_path}`;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
    return Buffer.from(res.data);
}

/**
 * Extract a usable file_id from a message (current or replied)
 */
function extractFileId(M) {
    const sources = [M, M.reply_to_message].filter(Boolean);
    for (const src of sources) {
        if (Array.isArray(src.photo) && src.photo.length) {
            // pick highest-res photo
            const last = src.photo[src.photo.length - 1];
            if (last && last.file_id) return last.file_id;
        }
        if (src.document && (src.document.mime_type || '').startsWith('image/')) {
            return src.document.file_id;
        }
        if (src.sticker && !src.sticker.is_animated && !src.sticker.is_video) {
            return src.sticker.file_id;
        }
    }
    return null;
}

async function runSharpify(client, arg, M, model, label, emoji) {
    const chatId = M.chat.id;

    const fileId = extractFileId(M);
    if (!fileId) {
        return client.sendMessage(chatId,
            `${emoji} *${label}*\n\n` +
            `Reply to an image (or send one with the command as caption).\n` +
            `Usage: reply to a photo with \`.${model}\``,
            { parse_mode: 'Markdown' }
        );
    }

    let status;
    try {
        status = await client.sendMessage(chatId, `${emoji} Processing image (${label})...`);
    } catch (_) {}

    try {
        const inputBuffer = await downloadTelegramFile(client, fileId);
        const outBuffer = await sharpify(inputBuffer, model);

        if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }

        // For removebg the result is PNG (transparency) → send as document so Telegram keeps it
        if (model === 'removebg') {
            await client.sendDocument(chatId, outBuffer, {
                caption: `${emoji} *${label}* completed`,
                parse_mode: 'Markdown',
                filename: 'sharpify_result.png',
                contentType: 'image/png'
            });
        } else {
            await client.sendPhoto(chatId, outBuffer, {
                caption: `${emoji} *${label}* completed`,
                parse_mode: 'Markdown'
            });
        }
    } catch (err) {
        if (status) { try { await client.deleteMessage(chatId, status.message_id); } catch (_) {} }
        console.error('Sharpify error:', err.message);
        await client.sendMessage(chatId,
            `❌ Failed to ${label.toLowerCase()} image. Please try again later.`,
            { parse_mode: 'Markdown' }
        );
    }
}

module.exports = {
    name: 'enhance',
    aliases: ['autoenhance', 'sharpify'],
    category: 'media',
    exp: 5,
    cool: 10,
    react: '✨',
    description: 'Auto-enhance an image (Sharpify)',
    usage: '.enhance (reply to image)',
    async execute(client, arg, M) {
        return runSharpify(client, arg, M, 'enhance', 'Auto-Enhance', '✨');
    },
    // Expose helpers in case other plugins want them
    _sharpify: sharpify,
    _downloadTelegramFile: downloadTelegramFile,
    _extractFileId: extractFileId,
    _runSharpify: runSharpify
};
