const axios = require("axios");
const crypto = require("crypto");

async function unlimitedAI(query) {
  // ===== GET CHAT ID =====
  const getRes = await axios.request({
    method: 'GET',
    url: 'https://app.unlimitedai.chat/id',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 15; 23124RA7EO Build/AQ3A.240829.003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.192 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'upgrade-insecure-requests': '1',
      'x-requested-with': 'mark.via.gp',
      'sec-fetch-site': 'cross-site',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-user': '?1',
      'sec-fetch-dest': 'document',
      'sec-ch-ua': '"Android WebView";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?1',
      'sec-ch-ua-platform': '"Android"',
      'referer': 'https://www.google.com/',
      'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'priority': 'u=0, i',
      'Cookie': 'NEXT_LOCALE=id;'
    }
  });

  const chatId = getRes.data.match(/\\"id\\":\\"([0-9a-f-]{36})\\"/)?.[1];
  if (!chatId) throw new Error("Chat ID tidak ditemukan");

  // ===== PAYLOAD =====
  const payload = JSON.stringify([{
    chatId,
    messages: [
      {
        id: crypto.randomUUID(),
        role: "user",
        content: "Jawab pakai bahasa Indonesia",
        parts: [{ type: "text", text: "Jawab pakai bahasa Indonesia" }],
        createdAt: `$D${new Date().toISOString()}`
      },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Hello! I am UnlimitedAI.Chat, and I\'m ready to create something compelling for you. What subject or story can I bring to life today?",
        parts: [{ type: "text", text: "Hello! I am UnlimitedAI.Chat, and I\'m ready to create something compelling for you. What subject or story can I bring to life today?" }],
        createdAt: `$D${new Date().toISOString()}`
      },
      {
        id: crypto.randomUUID(),
        role: "user",
        content: query,
        parts: [{ type: "text", text: query }],
        createdAt: `$D${new Date().toISOString()}`
      }
    ],
    selectedChatModel: "chat-model-reasoning",
    selectedCharacter: null,
    selectedStory: null,
    turnstileToken: "$undefined"
  }]);

  // ===== POST CHAT =====
  const chatRes = await axios.request({
    method: 'POST',
    url: `https://app.unlimitedai.chat/id/chat/${chatId}`,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 15; 23124RA7EO Build/AQ3A.240829.003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.192 Mobile Safari/537.36',
      'Accept': 'text/x-component',
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Content-Type': 'text/plain;charset=UTF-8',
      'sec-ch-ua-platform': '"Android"',
      'next-action': '40713570958bf1accf30e8d3ddb17e7948e6c379fa',
      'sec-ch-ua': '"Android WebView";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?1',
      'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%5B%22locale%22%2C%22id%22%2C%22d%22%5D%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
      'origin': 'https://app.unlimitedai.chat',
      'x-requested-with': 'mark.via.gp',
      'sec-fetch-site': 'same-origin',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'referer': `https://app.unlimitedai.chat/chat/${chatId}`,
      'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      'priority': 'u=1, i'
    },
    data: payload
  });

  // ===== PARSE STREAM → FULL TEXT =====
  let text = "";
  const regex = /"diff":\[\d+,"([^"]*)"\]/g;
  let m;

  while ((m = regex.exec(chatRes.data)) !== null) {
    text += m[1];
  }

  return text || "Tidak ada respon dari AI";
}

module.exports = {
  name: "UnlimitedAI",
  desc: "AI chat menggunakan UnlimitedAI",
  category: "Openai",
  path: "/ai/unlimited?apikey=&question=",

  async run(req, res) {
    const { question, apikey } = req.query;

    if (!question) {
      return res.json({ status: false, error: "Question is required" });
    }

    if (!apikey || !global.apikey?.includes(apikey)) {
      return res.json({ status: false, error: "Invalid API key" });
    }

    try {
      const result = await unlimitedAI(question);
      res.json({
        status: true,
        result
      });
    } catch (err) {
      res.status(500).json({
        status: false,
        error: err.message
      });
    }
  }
};