// src/Commands/Core/Mods.js
// List the configured owner + mod IDs (read from .env).
const { getOwnerIds, getModIds, isOwner } = require('../../core/permissions');

module.exports = {
    name: 'mods',
    aliases: ['listmods', 'staff'],
    category: 'core',
    description: 'Show configured bot owner and mods',
    usage: '.mods',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const ownerIds = getOwnerIds();
            const modIds = getModIds();
            const userId = String(M.from?.id || '');

            const escMd = (s) => String(s == null ? '' : s).replace(/([_*`\[\]])/g, '\\$1');

            let msg = `👑 *Bot Staff*\n\n`;
            msg += `*Owner${ownerIds.length > 1 ? 's' : ''}:*\n`;
            if (ownerIds.length === 0) {
                msg += `_(none configured)_\n`;
            } else {
                for (const id of ownerIds) msg += `• \`${escMd(id)}\`\n`;
            }
            msg += `\n*Mods:*\n`;
            if (modIds.length === 0) {
                msg += `_(none configured)_\n`;
            } else {
                for (const id of modIds) msg += `• \`${escMd(id)}\`\n`;
            }

            msg += `\n_Mods can ban, unban, mute and unmute users._`;

            if (isOwner(userId)) {
                msg += `\n\n*To configure*, edit \`.env\`:\n`;
                msg += `\`OWNER_ID=...\`\n`;
                msg += `\`MODS=<id1>,<id2>,...\``;
            }

            await client.sendMessage(chatId, msg, { parse_mode: 'Markdown' });
        } catch (err) {
            console.error('Mods command error:', err);
            await client.sendMessage(M.chat.id, `❌ Error: ${err.message}`);
        }
    }
};
