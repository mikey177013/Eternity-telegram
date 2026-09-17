// src/Commands/Fun/gaycheck.js
// Telegram port of the WhatsApp `gaycheck` command.
//
// Usage:
//   .gaycheck            -> check yourself
//   .gaycheck (reply)    -> check the replied user
//   .gaycheck @username  -> check the mentioned user

module.exports = {
    name: 'gaycheck',
    aliases: ['gay', 'gayrate'],
    category: 'fun',
    react: '🌈',
    exp: 1,
    cool: 4,
    description: 'Check how gay someone is 🌈',
    usage: '.gaycheck [@user | reply]',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const sender = M.from || {};

            // ----------- Resolve target -----------
            let targetId = String(sender.id || '');
            let targetName = sender.first_name || 'You';
            let isSelf = true;

            // 1) Replied user
            if (M.reply_to_message && M.reply_to_message.from) {
                targetId = String(M.reply_to_message.from.id);
                targetName = M.reply_to_message.from.first_name || 'User';
                isSelf = String(M.reply_to_message.from.id) === String(sender.id);
            }
            // 2) Text mention entity (clickable @username with linked user)
            else if (Array.isArray(M.entities)) {
                for (const e of M.entities) {
                    if (e.type === 'text_mention' && e.user) {
                        targetId = String(e.user.id);
                        targetName = e.user.first_name || 'User';
                        isSelf = String(e.user.id) === String(sender.id);
                        break;
                    }
                }
            }
            // 3) Plain @username — we can't reliably resolve it to a numeric id,
            //    so we treat the @handle itself as the "id" for the deterministic hash.
            if (isSelf && arg && /^@\w+/.test(arg.trim())) {
                const handle = arg.trim().split(/\s+/)[0];
                targetId = handle.toLowerCase();
                targetName = handle;
                isSelf = false;
            }

            // ----------- Deterministic "gay %" based on target id -----------
            // Same target -> same percentage. Stable, hash-based.
            const seed = String(targetId);
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                hash = ((hash << 5) - hash) + seed.charCodeAt(i);
                hash |= 0;
            }
            const percent = Math.abs(hash) % 101; // 0..100

            // ----------- Rainbow progress bar -----------
            const rainbow = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪'];
            const bars = 10;
            const filled = Math.round((percent / 100) * bars);
            let bar = '';
            for (let i = 0; i < bars; i++) {
                bar += i < filled ? rainbow[i % rainbow.length] : '⬛';
            }

            // ----------- Verdict text -----------
            let verdict;
            if (percent === 0)         verdict = '💀 Stone-cold straight. Suspiciously so.';
            else if (percent < 20)     verdict = '😐 Mostly straight, slight rainbow tint.';
            else if (percent < 40)     verdict = '🌈 Curious. The rainbow is calling.';
            else if (percent < 60)     verdict = '✨ Pretty gay, gotta admit it.';
            else if (percent < 80)     verdict = '💖 Very gay. Living their best life.';
            else if (percent < 100)    verdict = '🏳️‍🌈 Extremely gay. Top tier energy.';
            else                       verdict = '👑 100% absolutely fabulously gay. Iconic.';

            // ----------- Telegram-safe mention -----------
            const safeName = String(targetName).replace(/([_*`\[\]])/g, '\\$1');
            const isNumericId = /^\d+$/.test(String(targetId));
            const mention = isNumericId
                ? `[${safeName}](tg://user?id=${targetId})`
                : `*${safeName}*`;

            const text =
                `🌈 *Gay Check* 🌈\n\n` +
                `${isSelf ? 'You' : mention} ${isSelf ? 'are' : 'is'} *${percent}%* gay!\n\n` +
                `${bar}\n\n` +
                `${verdict}`;

            await client.sendMessage(chatId, text, {
                parse_mode: 'Markdown',
                reply_to_message_id: M.message_id,
                disable_web_page_preview: true
            });
        } catch (error) {
            console.error('gaycheck error:', error);
            try {
                await client.sendMessage(M.chat.id, `❌ Error: ${error.message}`);
            } catch (_) { /* ignore */ }
        }
    }
};
