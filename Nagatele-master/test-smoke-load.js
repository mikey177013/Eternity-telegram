/**
 * Smoke test: instantiate MessageHandler directly to make sure every
 * command file (including the new GroupChat/* files) loads cleanly,
 * and every handler module (including the new ChatFightHandler.js)
 * runs without throwing. Does NOT touch Telegram polling.
 */

process.env.TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || 'dummy:fake-token-for-smoke-test';

const MessageHandler = require('./src/adapters/telegram/MessageHandler');
const TelegramBot    = require('node-telegram-bot-api');

(async () => {
    // Build a fake client whose `bot` is a non-polling TelegramBot.
    // We don't call .start() / .startPolling(), so no network is hit.
    const bot = new TelegramBot('123:dummy', { polling: false });
    // No-op getMe so ChatFightHandler's selfBotId lookup is safe.
    bot.getMe = async () => ({ id: 9999, username: 'smoke_test_bot', is_bot: true });

    const fakeClient = {
        bot,
        sendMessage: async () => ({ message_id: 1 }),
        sendPhoto:   async () => ({ message_id: 1 }),
        database: null
    };

    const handler = new MessageHandler(fakeClient);
    fakeClient.handler = handler;

    // MessageHandler ctor kicks off async loadHandlers + loadCommands.
    // Give them a few seconds to finish.
    await new Promise((r) => setTimeout(r, 3500));

    const allCommands = Array.from(handler.commands.keys()).sort();
    const groupChatCmds = ['ranking', 'topusers', 'userstats', 'mytop'];
    const missing = groupChatCmds.filter((c) => !handler.commands.has(c));

    console.log(`\n📦 Total commands loaded: ${handler.commands.size}`);
    console.log(`🆕 GroupChat commands present: ${groupChatCmds.filter((c) => handler.commands.has(c)).join(', ') || '(none)'}`);
    if (missing.length) {
        console.error(`❌ Missing commands: ${missing.join(', ')}`);
        process.exit(1);
    }
    console.log('✅ All GroupChat commands loaded successfully');

    // Verify the ChatFightHandler actually attached a 'message' listener.
    const listeners = bot.listeners('message');
    console.log(`📡 'message' listeners attached: ${listeners.length}`);
    if (listeners.length < 1) {
        console.error('❌ No message listener attached — handler failed to load!');
        process.exit(1);
    }
    console.log('✅ ChatFightHandler attached message listener');

    // Make sure no existing command was clobbered (sample check).
    const sample = ['help', 'mana', 'leaderboard', 'cards', 'ranking'];
    for (const c of sample) {
        if (!handler.commands.has(c)) {
            console.error(`❌ Expected command "${c}" not present!`);
            process.exit(1);
        }
    }
    console.log(`✅ Existing commands intact (sample: ${sample.join(', ')})`);

    process.exit(0);
})().catch((e) => {
    console.error('FATAL:', e);
    process.exit(2);
});
