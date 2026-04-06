const axios = require("axios");
const crypto = require("crypto");

/* ================= UTIL ================= */

async function getBufferFromUrl(url) {
  const res = await axios.get(url, {
    responseType: "arraybuffer",
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  return Buffer.from(res.data);
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
    return cipher.update(data, "utf8", "base64") + cipher.final("base64");
  }

  randomString(len) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(crypto.randomBytes(len), b => chars[b % chars.length]).join("");
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

    return {
      app_id: this.appId,
      t,
      nonce,
      secret_key,
      sign: this.aesEncrypt(
        `${this.appId}:${RemoveClothes.#S}:${t}:${nonce}:${secret_key}`,
        aesKey,
        aesKey
      )
    };
  }

  async convert(buffer, prompt = "nude") {
    const user_id = this.randomString(64).toLowerCase();

    const api = axios.create({
      baseURL: "https://apiv1.deepfakemaker.io/api",
      params: this.auth(),
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Android 15)",
        referer: "https://deepfakemaker.io/ai-clothes-remover/"
      }
    });

    // Upload sign
    const { data: upload } = await api.post("/user/v2/upload-sign", {
      filename: `${Date.now()}.jpg`,
      hash: crypto.createHash("sha256").update(buffer).digest("hex"),
      user_id
    });

    // Upload image
    await axios.put(upload.data.url, buffer, {
      headers: {
        "content-type": "image/jpeg",
        "content-length": buffer.length
      }
    });

    // Bypass CF
    const { data: cf } = await axios.post(
      "https://api.nekolabs.web.id/tools/bypass/cf-turnstile",
      {
        url: "https://deepfakemaker.io/ai-clothes-remover/",
        siteKey: "0x4AAAAAAB6PHmfUkQvGufDI"
      }
    );

    if (!cf?.result) throw new Error("CF token gagal");

    // Create task
    const { data: task } = await api.post(
      "/img/v2/free/clothes/remover/task",
      {
        prompt,
        image: "https://cdn.deepfakemaker.io/" + upload.data.object_name,
        platform: "clothes_remover",
        user_id
      },
      { headers: { token: cf.result } }
    );

    // Polling
    return new Promise((resolve, reject) => {
      let retry = 40;

      const intv = setInterval(async () => {
        try {
          const { data } = await api.get(
            "/img/v2/free/clothes/remover/task",
            {
              params: { user_id, ...task.data }
            }
          );

          if (data.msg === "success") {
            clearInterval(intv);
            resolve(data.data.generate_url);
          } else if (--retry <= 0) {
            clearInterval(intv);
            reject(new Error("Timeout"));
          }
        } catch (e) {
          clearInterval(intv);
          reject(e);
        }
      }, 2500);
    });
  }
}


module.exports = {
  name: "Remove Clothes",
  desc: "AI Clothes Remover",
  category: "Tools",
  method: "POST",
  path: "/tools/removeclothes",
  body: {
    apikey: "string",
    image: "image",
    prompt: "string"
  },

  async run(req, res) {
    try {
      const { apikey, image, url, prompt } = req.body;

      if (!apikey || !global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      let buffer;
      if (req.files && req.files.length > 0) {
        buffer = req.files[0].buffer;
      }
      else if (image) {
        const clean = image.replace(/^data:image\/\w+;base64,/, "");
        buffer = Buffer.from(clean, "base64");
      }
      else if (url) {
        buffer = await getBufferFromUrl(url);
      }
      else {
        return res.json({
          status: false,
          error: "Masukkan file, base64, atau image URL"
        });
      }

      const ai = new RemoveClothes();
      const result = await ai.convert(buffer, prompt || "nude");

      res.json({
        status: true,
        result
      });

    } catch (e) {
      console.error("RemoveClothes Error:", e);
      res.status(500).json({
        status: false,
        error: e.message
      });
    }
  }
};