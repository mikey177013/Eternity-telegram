const moment = require("moment-timezone");

module.exports = {
  name: "info",
  aliases: ["botinfo", "about"],
  category: "core",
  description: "Show bot information",

  async execute(client, arg, M) {
    try {
      // Store start time once
      if (!client.startTime) client.startTime = Date.now();

      // Uptime calculation
      const uptimeMs = Date.now() - client.startTime;
      const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
      const minutes = Math.floor((uptimeMs / (1000 * 60)) % 60);
      const seconds = Math.floor((uptimeMs / 1000) % 60);
      const uptime = `${hours}h ${minutes}m ${seconds}s`;

      // Indian Time (IST)
      const indianTime = moment()
        .tz("Asia/Kolkata")
        .format("DD MMM YYYY • hh:mm:ss A");

      // Total commands
      const totalCmds = client.handler?.commands
        ? client.handler.commands.size
        : 0;

      const caption =
`🔰 <b>ZeroTwo INFO</b> 🔰

⏳ <b>Uptime:</b> ${uptime}
🕒 <b>Current Time:</b> ${indianTime}
🧩 <b>Total cmds:</b> ${totalCmds}
👥 <b>Total users:</b> Under progress
👤 <b>Owner:</b> Phoenix and Dipeshu
📍 <b>Official Group:</b> Under progress

🚀 <b>Powered by Eternity</b>`;

      await client.sendPhoto(
        M.chat.id,
        "https://files.catbox.moe/j2pyu7.jpg",
        {
          caption,
          parse_mode: "HTML",
          reply_to_message_id: M.message_id
        }
      );

    } catch (err) {
      console.error("INFO CMD ERROR:", err);
      await client.sendMessage(
        M.chat.id,
        "❌ Failed to load info.",
        { reply_to_message_id: M.message_id }
      );
    }
  }
};