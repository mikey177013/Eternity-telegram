require('dotenv').config();
const { TelegramClient } = require('./src/adapters/telegram/TelegramClient');

let client = null;

process.on('unhandledRejection', (reason, promise) => {
console.error('💥 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
console.error('🔥 Uncaught Exception:', err);
// Don’t exit — let process stay alive
});

async function startBot() {
try {
if (!process.env.TG_BOT_TOKEN) {
console.error('❌ Error: TG_BOT_TOKEN missing in .env');
return;
}

console.log('🚀 Starting Eternity Telegram Bot');  
console.log('📅', new Date().toLocaleString());  
console.log('🌐 Environment:', process.env.NODE_ENV || 'development');  

client = new TelegramClient(process.env.TG_BOT_TOKEN);  

await client.start();  
console.log('🎉 Bot is now running!');

} catch (error) {
console.error('💥 Bot failed to start:', error);
}
}

startBot();