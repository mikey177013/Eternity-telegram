// src/Commands/Utils/sticker.js
// Convert image / GIF / video / animation -> Telegram sticker
// Usage: reply to an image/GIF/video/sticker with .s or .sticker

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
} catch (_) {
  ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
}

let sharp = null;
try { sharp = require('sharp'); } catch (_) {}

module.exports = {
  name: 'sticker',
  aliases: ['s', 'stick', 'stickerize'],
  category: 'Utils',
  description: 'Convert image / GIF / video to sticker (reply to it with .s)',
  usage: 'Reply to an image/GIF/video with .s or .sticker',
  cooldown: 3,

  async execute(client, args, M) {
    const chatId = M.chat.id;

    try {
      if (!M.reply_to_message) {
        return; // No reply, do nothing silently
      }

      const replied = M.reply_to_message;

      // ---- Classify media type ----
      const hasPhoto = !!(replied.photo && replied.photo.length > 0);
      const hasAnimation = !!replied.animation; // GIF
      const hasVideo = !!replied.video;
      const hasVideoNote = !!replied.video_note;
      const hasSticker = !!replied.sticker;
      const hasDoc = !!replied.document;

      let docMime = hasDoc ? (replied.document.mime_type || '') : '';
      const docIsImage = hasDoc && /^image\/(png|jpe?g|webp|gif)$/i.test(docMime);
      const docIsVideo = hasDoc && /^video\//i.test(docMime);

      // Determine static vs animated
      const isAnimatedSrc = hasAnimation || hasVideo || hasVideoNote || docIsVideo
        || (hasSticker && (replied.sticker.is_animated || replied.sticker.is_video))
        || (hasDoc && /gif/i.test(docMime));

      const isStaticImage = hasPhoto || (hasDoc && docIsImage && !/gif/i.test(docMime))
        || (hasSticker && !replied.sticker.is_animated && !replied.sticker.is_video);

      if (!isAnimatedSrc && !isStaticImage) {
        return; // Unsupported, fail silently
      }

      // Get the file id
      let fileId = null;
      if (hasPhoto) {
        // Use highest quality available
        const photos = replied.photo;
        fileId = photos[photos.length - 1].file_id;
      } else if (hasAnimation) {
        fileId = replied.animation.file_id;
      } else if (hasVideo) {
        fileId = replied.video.file_id;
      } else if (hasVideoNote) {
        fileId = replied.video_note.file_id;
      } else if (hasSticker) {
        fileId = replied.sticker.file_id;
      } else if (hasDoc) {
        fileId = replied.document.file_id;
      }
      if (!fileId) return;

      // Static image -> try sending directly first (Telegram accepts PNG/JPEG for static stickers)
      if (isStaticImage) {
        try {
          await client.sendSticker(chatId, fileId, { reply_to_message_id: M.message_id });
          try { await client.deleteMessage(chatId, M.message_id); } catch (_) {}
          return;
        } catch (_) {
          // Fall through to manual conversion
        }
      }

      // Acquire bot token
      let botToken = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TG_BOT_TOKEN;
      if (!botToken && client.bot?.token) botToken = client.bot.token;
      else if (!botToken && client.telegram?.token) botToken = client.telegram.token;
      if (!botToken) return;

      // Download the source media
      const file = await client.getFile(fileId);
      if (!file?.file_path) return;
      const srcUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'sticker-'));
      const srcExt = (path.extname(file.file_path) || '').toLowerCase() || (isAnimatedSrc ? '.mp4' : '.jpg');
      const srcFile = path.join(tmpDir, `src${srcExt}`);
      const outFile = path.join(tmpDir, 'out.webp');

      try {
        const resp = await axios({
          method: 'GET',
          url: srcUrl,
          responseType: 'arraybuffer',
          timeout: 60000,
        });
        await fs.promises.writeFile(srcFile, Buffer.from(resp.data));

        if (isAnimatedSrc) {
          // Convert video/GIF -> animated webp using ffmpeg
          await convertToAnimatedWebp(srcFile, outFile);
        } else {
          // Convert static image -> webp 512x512 transparent
          await convertToStaticWebp(srcFile, outFile);
        }

        const buf = await fs.promises.readFile(outFile);
        await client.sendSticker(chatId, buf, { reply_to_message_id: M.message_id });

        try { await client.deleteMessage(chatId, M.message_id); } catch (_) {}
      } finally {
        // Cleanup tmp directory
        try {
          for (const f of await fs.promises.readdir(tmpDir)) {
            await fs.promises.unlink(path.join(tmpDir, f)).catch(() => {});
          }
          await fs.promises.rmdir(tmpDir).catch(() => {});
        } catch (_) {}
      }

    } catch (err) {
      console.log('Sticker command failed:', err.message);
      try {
        await client.sendMessage(chatId,
          `❌ Failed to create sticker: ${err.message || 'unknown error'}`,
          { reply_to_message_id: M.message_id }
        );
      } catch (_) {}
    }
  }
};

/**
 * Convert a static image to a 512x512 transparent webp Telegram sticker.
 */
async function convertToStaticWebp(srcFile, outFile) {
  if (sharp) {
    try {
      await sharp(srcFile)
        .resize(512, 512, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .webp({ quality: 90 })
        .toFile(outFile);
      return;
    } catch (e) {
      // Fall through to ffmpeg
    }
  }

  // Fallback: ffmpeg
  await runFfmpeg([
    '-y',
    '-i', srcFile,
    '-vf', "scale='if(gt(iw,ih),512,-2)':'if(gt(iw,ih),-2,512)',pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
    '-vcodec', 'libwebp',
    '-lossless', '0',
    '-q:v', '80',
    '-preset', 'default',
    '-an', '-vsync', '0',
    outFile,
  ]);
}

/**
 * Convert a video/GIF/animation to an animated webp sticker.
 * Telegram requirement: max 512x512, ≤ 3 seconds, ≤ 30fps, file ≤ 256kb.
 */
async function convertToAnimatedWebp(srcFile, outFile) {
  // First pass: short, downsampled
  await runFfmpeg([
    '-y',
    '-t', '3',                       // max 3 seconds
    '-i', srcFile,
    '-vf',
      "fps=15,scale='if(gt(iw,ih),512,-2)':'if(gt(iw,ih),-2,512)',pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
    '-vcodec', 'libwebp',
    '-lossless', '0',
    '-compression_level', '6',
    '-q:v', '50',
    '-loop', '0',
    '-preset', 'default',
    '-an', '-vsync', '0',
    outFile,
  ]);

  // If too large, do another pass with lower quality
  try {
    const stat = await fs.promises.stat(outFile);
    if (stat.size > 256 * 1024) {
      await runFfmpeg([
        '-y',
        '-t', '2.8',
        '-i', srcFile,
        '-vf',
          "fps=10,scale='if(gt(iw,ih),512,-2)':'if(gt(iw,ih),-2,512)',pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        '-vcodec', 'libwebp',
        '-lossless', '0',
        '-compression_level', '6',
        '-q:v', '30',
        '-loop', '0',
        '-preset', 'default',
        '-an', '-vsync', '0',
        outFile,
      ]);
    }
  } catch (_) {}
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const bin = ffmpegPath || 'ffmpeg';
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (code ${code}): ${stderr.slice(-500)}`));
    });
  });
}
