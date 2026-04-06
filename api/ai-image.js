const fetch = require("node-fetch"); // node-fetch@2
const FormData = require("form-data");
const fs = require("fs");
const axios = require("axios");

async function ezremove(image,
  prompt = "Ubah jadi zombie",
  model = "ezremove_4.0",
  ratio = "match_input_image",
  interval = 3000,
  maxTry = 40) {

  /* ===== product-serial ===== */
  const productSerial =
    "browser_" + Date.now() + "_" + Math.random().toString(36).slice(2, 12);

  /* ===== form ===== */
  const form = new FormData();
  form.append("model_name", model);
  form.append("prompt", prompt);
  form.append("ratio", ratio);

  if (Buffer.isBuffer(image)) {
    form.append("target_images", image, {
      filename: "image.jpg",
      contentType: "image/jpeg"
    });

  } else if (typeof image === "string" && image.startsWith("http")) {
    const res = await axios.get(image, { responseType: "arraybuffer" });
    form.append("target_images", Buffer.from(res.data), {
      filename: "image.jpg",
      contentType: "image/jpeg"
    });

  } else if (typeof image === "string" && fs.existsSync(image)) {
    form.append("target_images", fs.createReadStream(image));

  } else {
    throw new Error("Image harus URL / Buffer / file path");
  }

  /* ===== CREATE JOB ===== */
  const createRes = await fetch(
    "https://api.ezremove.ai/api/ez-remove/photo-editor/create-job",
    {
      method: "POST",
      headers: {
        ...form.getHeaders(),

        // header ASLI (tidak diubah)
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 15; 23124RA7EO Build/AQ3A.240829.003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.192 Mobile Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "sec-ch-ua-platform": "\"Android\"",
        "product-serial": productSerial,
        "sec-ch-ua":
          "\"Android WebView\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
        "sec-ch-ua-mobile": "?1",
        "origin": "https://ezremove.ai",
        "x-requested-with": "mark.via.gp",
        "sec-fetch-site": "same-site",
        "sec-fetch-mode": "cors",
        "sec-fetch-dest": "empty",
        "referer": "https://ezremove.ai/",
        "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "priority": "u=1, i"
      },
      body: form
    }
  );

  const createJson = await createRes.json();
  const jobId = createJson?.result?.job_id;
  if (!jobId) throw new Error("Gagal mendapatkan job_id");

  /* ===== POLLING ===== */
  for (let i = 0; i < maxTry; i++) {
    const res = await fetch(
      `https://api.ezremove.ai/api/ez-remove/photo-editor/get-job/${jobId}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 15; 23124RA7EO Build/AQ3A.240829.003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.192 Mobile Safari/537.36",
          "Accept": "application/json, text/plain, */*",
          "Accept-Encoding": "gzip, deflate, br, zstd",
          "sec-ch-ua-platform": "\"Android\"",
          "product-serial": productSerial,
          "sec-ch-ua":
            "\"Android WebView\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
          "sec-ch-ua-mobile": "?1",
          "origin": "https://ezremove.ai",
          "x-requested-with": "mark.via.gp",
          "sec-fetch-site": "same-site",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
          "referer": "https://ezremove.ai/",
          "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
          "priority": "u=1, i"
        }
      }
    );

    const data = await res.json();

    if (
      data?.result?.status === 2 &&
      Array.isArray(data.result.output) &&
      data.result.output.length
    ) {
      return {
        job_id: jobId,
        product_serial: productSerial,
        output: data.result.output
      };
    }

    if (data?.result?.status === 3) {
      throw new Error("Job gagal: " + data.result.error);
    }

    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error("Timeout: output belum tersedia");
}


module.exports = {
  name: "Image Creator",
  desc: "Edit image from prompt",
  category: "Openai",
  method: "POST",
  path: "/ai/image",
  body: { apikey: "string", prompt: "string", image: "image" },

  async run(req, res) {
    try {
    const { apikey, image, prompt } = req.body;

    if (!apikey || !global.apikey.includes(apikey)) {
      return res.json({ status: false, error: "Apikey invalid" });
    }
    
    console.log(image)

    let imageData;

    // 1️⃣ Upload file
    if (req.files && req.files.length > 0) {
      imageData = req.files[0].buffer;
    }
    // 2️⃣ Base64 string (BARU)
    else if (image) {
      // Hapus prefix "data:image/xxx;base64," jika ada
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      imageData = Buffer.from(base64Data, 'base64');
    }
    // 3️⃣ URL
    else if (url) {
      imageData = url;
    }
    else {
      return res.json({
        status: false,
        error: "Masukkan image URL, upload file, atau base64 string"
      });
    }
    
      const result = await ezremove(imageData, prompt);

      res.json({
        status: true,
        result
      });
    } catch (e) {
      res.status(500).json({
        status: false,
        error: e.message
      });
    }
  }
};