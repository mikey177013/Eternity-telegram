class Context {
    constructor(ctx) // src/adapters/telegram/Context.js
class Context {
    constructor(ctx, messageHandler = null) {
        this.ctx = ctx;
        this.message = ctx.message || ctx;
        this.messageHandler = messageHandler;
    }

    get from() {
        return this.ctx.chat?.id || this.ctx.from?.id;
    }

    get sender() {
        return this.ctx.from?.id;
    }

    get chat() {
        return {
            id: this.ctx.chat?.id,
            type: this.ctx.chat?.type
        };
    }

    get reply_to_message() {
        return this.ctx.reply_to_message || this.message.reply_to_message;
    }

    get message_id() {
        return this.ctx.message_id || this.message.message_id;
    }

    get text() {
        return this.ctx.text || this.message.text || '';
    }

    async reply(text, extra = {}) {
        return this.ctx.reply(text, extra);
    }

    async sendPhoto(photo, extra = {}) {
        return this.ctx.replyWithPhoto(photo, extra);
    }

    async sendMessage(text, extra = {}) {
        return this.ctx.reply(text, extra);
    }

    async sendMessageToChat(chatId, text, extra = {}) {
        // For sending messages to specific chat (not just reply)
        return this.ctx.telegram.sendMessage(chatId, text, extra);
    }

    // Anti-spam helper methods
    async isAdminOrOwner(chatId, userId) {
        if (this.messageHandler) {
            return this.messageHandler.isAdminOrOwner(chatId, userId);
        }
        return false;
    }

    async muteUser(chatId, userId, durationMs, reason, originalMsg = null) {
        if (this.messageHandler) {
            return this.messageHandler.muteUser(chatId, userId, durationMs, reason, originalMsg);
        }
        return false;
    }

    async unmuteUser(chatId, userId, adminId) {
        if (this.messageHandler) {
            return this.messageHandler.unmuteUser(chatId, userId, adminId);
        }
        return { success: false, message: 'Message handler not available' };
    }

    isUserMuted(chatId, userId) {
        if (this.messageHandler) {
            return this.messageHandler.isUserMuted(chatId, userId);
        }
        return false;
    }

    // Parse duration helper
    parseMuteDuration(durationStr) {
        if (this.messageHandler) {
            return this.messageHandler.parseMuteDuration(durationStr);
        }
        return null;
    }
}

module.exports = { Context };
        this.ctx = ctx;
    }

    get from() {
        return this.ctx.chat.id;
    }

    get sender() {
        return this.ctx.from.id;
    }

    async reply(text, extra = {}) {
        return this.ctx.reply(text, extra);
    }

    async sendPhoto(photo, extra = {}) {
        return this.ctx.replyWithPhoto(photo, extra);
    }

    async sendMessage(text, extra = {}) {
        return this.ctx.reply(text, extra);
    }
}

module.exports = { Context };