const axios = require("axios");
const crypto = require("crypto");
const FormData = require("form-data");

/* ================= UTIL ================= */

async function getBufferFromUrl(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    timeout: 30000
  });
  return Buffer.from(res.data);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ================= AI CLASS ================= */

class RemoveClothes {
  static #PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDa2oPxMZe71V4dw2r8rHWt59gH
W5INRmlhepe6GUanrHykqKdlIB4kcJiu8dHC/FJeppOXVoKz82pvwZCmSUrF/1yr
rnmUDjqUefDu8myjhcbio6CnG5TtQfwN2pz3g6yHkLgp8cFfyPSWwyOCMMMsTU9s
snOjvdDb4wiZI8x3UwIDAQAB
-----END PUBLIC KEY-----`;

  static #S = "NHGNy5YFz7HeFb";

  constructor(appId = "ai_df") {
    this.appId = appId;
  }

  aesEncrypt(data, key, iv) {
    const cipher = crypto.createCipheriv(
      "aes-128-cbc",
      Buffer.from(key, "utf8"),
      Buffer.from(iv, "utf8")
    );
    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");
    return encrypted;
  }

  randomString(len) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < len; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
  }

  auth() {
    const t = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const aesKey = this.randomString(16);

    const secret_key = crypto.publicEncrypt(
      {
        key: RemoveClothes.#PUBLIC_KEY,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(aesKey)
    ).toString("base64");

    const signData = `${this.appId}:${RemoveClothes.#S}:${t}:${nonce}:${secret_key}`;
    const sign = this.aesEncrypt(signData, aesKey, aesKey);

    return {
      app_id: this.appId,
      t,
      nonce,
      secret_key,
      sign
    };
  }

  async getCFToken() {
    // Fallback: coba beberapa metode bypass
    const methods = [
      async () => {
        // Method 1: Pake API eksternal (kode lu)
        const { data } = await axios.post(
          "https://api.nekolabs.web.id/tools/bypass/cf-turnstile",
          {
            url: "https://deepfakemaker.io/ai-clothes-remover/",
            siteKey: "0x4AAAAAAB6PHmfUkQvGufDI"
          },
          { timeout: 30000 }
        );
        return data?.result;
      },
      async () => {
        // Method 2: Pake capsolver alternatif
        const { data } = await axios.post(
          "https://api.capsolver.com/createTask",
          {
            clientKey: "YOUR_CAPSOLVER_KEY",
            task: {
              type: "TurnstileTaskProxyless",
              websiteURL: "https://deepfakemaker.io/ai-clothes-remover/",
              websiteKey: "0x4AAAAAAB6PHmfUkQvGufDI"
            }
          },
          { timeout: 30000 }
        );
        return data?.solution?.token;
      }
    ];

    for (const method of methods) {
      try {
        const token = await method();
        if (token) return token;
      } catch (e) {
        console.log("CF method failed:", e.message);
      }
    }
    
    // Kalo semua gagal, return dummy token (resiko)
    console.warn("⚠️ Using dummy CF token - mungkin gagal");
    return "dummy_token_for_testing";
  }

  async convert(buffer, prompt = "nude") {
    const user_id = this.randomString(64).toLowerCase();
    
    // Validasi buffer
    if (!buffer || buffer.length === 0) {
      throw new Error("Buffer kosong atau invalid");
    }

    // Cek tipe file (harus image)
    const isJPEG = buffer[0] === 0xFF && buffer[1] === 0xD8;
    const isPNG = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    
    if (!isJPEG && !isPNG) {
      throw new Error("File harus berupa gambar JPEG atau PNG");
    }

    const api = axios.create({
      baseURL: "https://apiv1.deepfakemaker.io/api",
      params: this.auth(),
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Referer": "https://deepfakemaker.io/ai-clothes-remover/",
        "Origin": "https://deepfakemaker.io"
      },
      timeout: 60000
    });

    try {
      // 1. Upload sign
      console.log("📤 Getting upload sign...");
      const hash = crypto.createHash("sha256").update(buffer).digest("hex");
      const filename = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      
      const { data: upload } = await api.post("/user/v2/upload-sign", {
        filename,
        hash,
        user_id
      });

      if (!upload?.data?.url) {
        throw new Error("Failed to get upload URL");
      }

      // 2. Upload image ke S3/CDN
      console.log("📤 Uploading image...");
      await axios.put(upload.data.url, buffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": buffer.length
        },
        timeout: 60000
      });

      // 3. Bypass Cloudflare (opsional, bisa di-skip kalo error)
      let cfToken = null;
      try {
        console.log("🔐 Getting CF token...");
        cfToken = await this.getCFToken();
      } catch (e) {
        console.warn("⚠️ CF bypass failed, continuing without token:", e.message);
      }

      // 4. Create task
      console.log("🎨 Creating removal task...");
      const taskPayload = {
        prompt,
        image: "https://cdn.deepfakemaker.io/" + upload.data.object_name,
        platform: "clothes_remover",
        user_id
      };

      const taskHeaders = {};
      if (cfToken) {
        taskHeaders.token = cfToken;
      }

      const { data: task } = await api.post(
        "/img/v2/free/clothes/remover/task",
        taskPayload,
        { headers: taskHeaders }
      );

      if (!task?.data?.task_id && !task?.data?.id) {
        throw new Error("Failed to create task: " + JSON.stringify(task));
      }

      const taskId = task.data.task_id || task.data.id;

      // 5. Polling untuk hasil
      console.log("⏳ Waiting for result...");
      let retry = 60; // 60 × 3dtk = 180dtk (3 menit)
      let lastError = null;

      while (retry-- > 0) {
        await delay(3000);
        
        try {
          const { data } = await api.get("/img/v2/free/clothes/remover/task", {
            params: { user_id, task_id: taskId }
          });

          if (data.msg === "success" && data.data?.generate_url) {
            console.log("✅ Success! Image generated.");
            return data.data.generate_url;
          } 
          
          if (data.msg === "failed" || data.status === "failed") {
            throw new Error("Task failed: " + (data.error || "Unknown error"));
          }
          
          if (data.data?.progress) {
            console.log(`📊 Progress: ${data.data.progress}%`);
          }
          
          lastError = null;
          
        } catch (e) {
          lastError = e;
          console.log(`⚠️ Polling error (${retry} retries left):`, e.message);
          if (retry <= 0) break;
        }
      }

      throw new Error(lastError?.message || "Timeout waiting for result");

    } catch (error) {
      console.error("RemoveClothes Error:", error.message);
      throw error;
    }
  }
}

/* ================= API ENDPOINT ================= */

module.exports = {
  name: "Remove Clothes",
  desc: "AI Clothes Remover - Remove clothes from image using AI",
  category: "Tools",
  method: "POST",
  path: "/tools/removeclothes",
  body: {
    apikey: "string (required)",
    image: "base64 or file",
    url: "image url",
    prompt: "string (optional, default: nude)"
  },

  async run(req, res) {
    try {
      const { apikey, image, url, prompt } = req.body;

      // Validasi API key
      if (!apikey) {
        return res.status(401).json({ 
          status: false, 
          error: "Apikey diperlukan" 
        });
      }

      if (!global.apikey || !global.apikey.includes(apikey)) {
        return res.status(403).json({ 
          status: false, 
          error: "Apikey invalid" 
        });
      }

      // Ambil buffer image
      let buffer = null;

      // Case 1: File upload via multipart
      if (req.files && req.files.length > 0) {
        buffer = req.files[0].buffer;
        console.log(`📁 Received file: ${req.files[0].originalname}, size: ${buffer.length}`);
      }
      // Case 2: Base64 string
      else if (image && typeof image === 'string') {
        const clean = image.replace(/^data:image\/\w+;base64,/, "");
        buffer = Buffer.from(clean, "base64");
        console.log(`📷 Received base64, size: ${buffer.length}`);
      }
      // Case 3: URL
      else if (url && typeof url === 'string') {
        console.log(`🌐 Fetching image from URL: ${url.substring(0, 100)}`);
        buffer = await getBufferFromUrl(url);
        console.log(`📥 Downloaded, size: ${buffer.length}`);
      }
      else {
        return res.status(400).json({
          status: false,
          error: "Masukkan file, base64, atau image URL"
        });
      }

      // Validasi buffer tidak kosong
      if (!buffer || buffer.length < 100) {
        return res.status(400).json({
          status: false,
          error: "File gambar terlalu kecil atau corrupt"
        });
      }

      // Proses dengan AI
      console.log("🤖 Starting AI clothes removal...");
      const ai = new RemoveClothes();
      const resultUrl = await ai.convert(buffer, prompt || "nude");

      // Return hasil
      res.json({
        status: true,
        result: resultUrl,
        message: "Image processed successfully"
      });

    } catch (error) {
      console.error("RemoveClothes API Error:", error);
      
      res.status(500).json({
        status: false,
        error: error.message || "Internal server error"
      });
    }
  }
};
