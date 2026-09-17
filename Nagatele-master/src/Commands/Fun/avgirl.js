// src/Commands/Fun/avgirl.js
module.exports = {
  name: "avgirl",
  aliases: ["animegirl", "animegirlvid", "av", "ag", "animev"],
  category: "fun",
  description: "Generate an anime girl GIF with your text",

  async execute(client, arg, M) {
    try {
      // Get text from args or message text
      let text = '';
      if (Array.isArray(arg)) {
        text = arg.join(" ").trim();
      } else if (typeof arg === 'string') {
        text = arg.trim();
      }

      // If no text, check replied message
      if (!text && M.reply_to_message?.text) {
        text = M.reply_to_message.text.trim();
      }

      // Validate input
      if (!text) {
        return client.sendMessage(M.chat.id, 
          "❌ Please provide text!\nExample: `.avgirl Hello`",
          { reply_to_message_id: M.message_id }
        );
      }

      // Check text length
      if (text.length > 100) {
        return client.sendMessage(M.chat.id,
          "❌ Text too long! Max 100 characters.",
          { reply_to_message_id: M.message_id }
        );
      }

      // Send loading message
      const loadingMsg = await client.sendMessage(M.chat.id, "⏳ Generating GIF...", { reply_to_message_id: M.message_id });

      // Call API
      const fetch = require("node-fetch");
      const apiUrl = `https://api.mifinfinity.my.id/api/canvas/animegirl/video?text=${encodeURIComponent(text)}`;
      const res = await fetch(apiUrl);
      const data = await res.json();

      if (!data.results?.url) throw new Error("No GIF URL received");

      // Send GIF
      await client.sendAnimation(M.chat.id, data.results.url, {
        caption: "",
        reply_to_message_id: M.message_id,
        supports_streaming: true
      });

      // Delete loading message
      await client.deleteMessage(M.chat.id, loadingMsg.message_id);

    } catch (error) {
      console.error("Error generating anime girl GIF:", error);
      await client.sendMessage(M.chat.id,
        "❌ Failed to generate GIF. Try again later.",
        { reply_to_message_id: M.message_id }
      );
    }
  }
};