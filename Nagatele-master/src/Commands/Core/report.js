

module.exports = {
  name: 'report',
  aliases: ['rep'],
  category: 'core',
  description: 'Send a report to the admin',
  cool: 5,
  exp: 0,

  async execute(client, arg, M) {
    try {
      // Get report text
      const reportText = arg?.join ? arg.join(" ").trim() : String(arg || "").trim();
      if (!reportText) {
        return await client.sendMessage(M.chat.id, "❌ Please provide a report message.\nExample: `.report This user is spamming`");
      }

      // Group info
      const chat = M.chat;
      const groupName = chat?.title || "Unknown";
      let groupLink = "N/A";

      // Try to get invite link if bot is admin
      try {
        const chatInfo = await client.bot.getChat(chat.id);
        if (chatInfo.invite_link) groupLink = chatInfo.invite_link;
      } catch(e) {
        groupLink = "N/A";
      }

      // Admin DM
      const adminId = 7998469369; // Your Telegram ID
      const adminUsername = "@R0ronoaZoro";

      await client.sendMessage(adminId, `
📩 *New Report Received*

👤 By: ${M.from?.username ? "@" + M.from.username : "User_" + M.from?.id}
🆔 User ID: ${M.from?.id}
🏷️ Group: ${groupName}
🔗 Group Link: ${groupLink}
📝 Report: ${reportText}
      `, { parse_mode: "Markdown" });

      // Confirm to reporter
      await client.sendMessage(M.chat.id, "✅ Your report has been received. The admin will review it shortly.");

    } catch (err) {
      console.error("❌ Report command error:", err);
      await client.sendMessage(M.chat.id, "❌ Failed to send report. Please try again later.");
    }
  }
};