const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const FormData = require("form-data");
const fs = require("fs");

async function photoToAnime(imageData) {
  // ===== upload =====
  const form = new FormData();

  if (Buffer.isBuffer(imageData)) {
    form.append("files", imageData, {
      filename: "image.jpg",
      contentType: "image/jpeg"
    });
  } else {
    // URL
    form.append("files", imageData);
  }

  const uploadRes = await fetch(
    "https://luca115-qwen-image-edit-2509-loras-fast.hf.space/gradio_api/upload",
    {
      method: "POST",
      body: form,
      headers: {
        ...form.getHeaders(),
        "User-Agent": "Mozilla/5.0",
        origin: "https://upsampler.com",
        referer: "https://upsampler.com/"
      }
    }
  );

  const [tmpPath] = await uploadRes.json();

  // ===== join queue =====
  const sessionHash = Math.random().toString(36).slice(2);

  const joinRes = await fetch(
    "https://luca115-qwen-image-edit-2509-loras-fast.hf.space/gradio_api/queue/join",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
        "x-gradio-user": "api",
        origin: "https://upsampler.com",
        referer: "https://upsampler.com/"
      },
      body: JSON.stringify({
        data: [
          {
            path: tmpPath,
            meta: { _type: "gradio.FileData" }
          },
          "Convert this photo to anime style",
          "Photo-to-Anime",
          0,
          true,
          1,
          4
        ],
        fn_index: 1,
        session_hash: sessionHash
      })
    }
  );

  const { event_id } = await joinRes.json();

  // ===== listen SSE =====
  const sseRes = await fetch(
    `https://luca115-qwen-image-edit-2509-loras-fast.hf.space/gradio_api/queue/data?session_hash=${sessionHash}`,
    {
      headers: {
        Accept: "text/event-stream",
        "User-Agent": "Mozilla/5.0"
      }
    }
  );

  const text = await sseRes.text();
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line.startsWith("data:")) continue;

    const payload = JSON.parse(line.replace("data: ", ""));
    if (payload.msg === "process_completed" && payload.event_id === event_id) {
      return payload.output.data[0].url;
    }
  }

  throw new Error("Anime result not found");
}


module.exports = {
  name: "Jadi Anime",
  desc: "Convert gambar ke anime style",
  category: "Tools",
  method: "POST",
  path: "/tools/jadianime",
  body: { apikey: "string", image: "image" },

  async run(req, res) {
    try {
      const { apikey, image } = req.body;

      if (!apikey || !global.apikey.includes(apikey)) {
        return res.json({
          status: false,
          error: "Apikey invalid"
        });
      }

      let imageData;

      if (req.files && req.files.length > 0) {
        imageData = req.files[0].buffer;
      }
      else if (image) {
        imageData = image
      }
      else {
        return res.json({
          status: false,
          error: "Masukkan image URL atau upload file"
        });
      }

      const result = await photoToAnime(imageData);

      return res.json({
        status: true,
        result
      });

    } catch (e) {
      console.error("Anime Error:", e);
      res.status(500).json({
        status: false,
        error: e.message
      });
    }
  }
};