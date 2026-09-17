async function commandMiddleware(ctx, next) {
    const message = ctx.message?.text;
    if (!message) return;

    // Can add global checks, cooldowns, etc.
    await next();
}

module.exports = { commandMiddleware };