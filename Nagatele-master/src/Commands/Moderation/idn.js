// src/Commands/Moderation/idn.js
const { resolveTargetUser } = require('../../Helpers/mention');

module.exports = {
    name: 'idn',
    aliases: ['getnumber'],
    category: 'moderation',
    description: 'Get user phone number (Owner only receives the data)',
    usage: '.idn @user | reply .idn | .idn <user_id>',
    exp: 0,
    cool: 5,
    react: '📞',

    async execute(client, arg, M) {
        try {
            const chatId = M.chat.id;
            const userId = M.from.id;

            // ONLY THIS USER RECEIVES THE INFO
            const OWNER_ID = 7998469369;

            // Group only
            if (!['group', 'supergroup'].includes(M.chat.type)) {
                return client.sendMessage(chatId,
                    '❌ Group only command',
                    { reply_to_message_id: M.message_id });
            }

            // Admin/owner check
            const isAdmin = await client.handler.isAdminOrOwner(chatId, userId);
            if (!isAdmin) {
                return client.sendMessage(chatId,
                    '❌ Admins only',
                    { reply_to_message_id: M.message_id });
            }

            // Resolve target user
            const target = await resolveTargetUser(client, M, arg);

            if (!target || !target.id) {
                return client.sendMessage(chatId,
                    'Usage:\n' +
                    '1. Reply `.idn` to user\n' +
                    '2. `.idn @username`\n' +
                    '3. `.idn 123456789`',
                    { reply_to_message_id: M.message_id, parse_mode: 'Markdown' });
            }

            const targetUserId = parseInt(target.id);

            // Processing message
            const processingMsg = await client.sendMessage(chatId,
                '🔍 Processing...',
                { reply_to_message_id: M.message_id });

            // Get user info from database
            const userInfo = await client.database.getUserByTelegramId(targetUserId);

            // Delete processing message
            try { await client.deleteMessage(chatId, processingMsg.message_id); } catch (_) {}

            if (!userInfo) {
                try {
                    await client.sendMessage(OWNER_ID,
                        `❌ IDN: User ${targetUserId} not found\n` +
                        `Requested by: ${M.from.first_name} (${userId})\n` +
                        `Group: ${M.chat.title}\n` +
                        `Time: ${new Date().toLocaleString()}`);
                } catch (_) {}

                return client.sendMessage(chatId,
                    '✅ Lookup completed',
                    { reply_to_message_id: M.message_id });
            }

            // ===== SEND INFO TO OWNER ONLY =====
            try {
                await client.sendMessage(OWNER_ID,
                    `🔍 IDN LOOKUP\n\n` +
                    `👤 From: ${M.from.first_name} (${userId})\n` +
                    `👥 Group: ${M.chat.title}\n` +
                    `⏰ Time: ${new Date().toLocaleString()}\n\n` +
                    `🎯 TARGET USER\n` +
                    `📛 Name: ${userInfo.full_name || 'N/A'}\n` +
                    `📱 Phone: ${userInfo.phone_number}\n` +
                    `🆔 ID: ${userInfo.user_id}\n` +
                    `📝 Username: ${userInfo.username || 'N/A'}\n` +
                    `📅 Registered: ${new Date(userInfo.registered_at).toLocaleString()}`);

                console.log(`✅ Sent IDN info to owner ${OWNER_ID}`);
            } catch (sendError) {
                console.error('Failed to send to owner:', sendError.message);
            }

            // Public ack only
            await client.sendMessage(chatId,
                '✅ Lookup completed',
                { reply_to_message_id: M.message_id });

        } catch (err) {
            console.error('IDN error:', err);
            await client.sendMessage(M.chat.id,
                '❌ Error',
                { reply_to_message_id: M.message_id });
        }
    },
};
