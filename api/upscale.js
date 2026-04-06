const axios = require("axios");
const FormData = require("form-data");

async function uploadImageToCloudinary(imageData) {
  try {
    const timestamp = Math.floor(Date.now() / 1000);

    const signRes = await axios.post(
      "https://cloudinary-tools.netlify.app/.netlify/functions/sign-upload-params",
      {
        paramsToSign: {
          timestamp,
          upload_preset: "cloudinary-tools",
          source: "ml"
        }
      },
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Content-Type": "application/json"
        }
      }
    );

    const { signature } = signRes.data;

    const form = new FormData();
    form.append("upload_preset", "cloudinary-tools");
    form.append("source", "ml");
    form.append("signature", signature);
    form.append("timestamp", timestamp);
    form.append("api_key", "985946268373735");

    // imageData DIJAMIN BUFFER
    form.append("file", imageData, {
      filename: "image.jpg",
      contentType: "image/jpeg"
    });

    const uploadRes = await axios.post(
      "https://api.cloudinary.com/v1_1/dtz0urit6/auto/upload",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    return `https://res.cloudinary.com/dtz0urit6/image/upload/f_jpg,w_512,e_upscale,q_auto/${uploadRes.data.public_id}.jpg`;
  } catch (err) {
    throw new Error(err.message);
  }
}

module.exports = {
  name: "Upscaler",
  desc: "Upscale gambar via body buffer",
  category: "Tools",
  method: "POST",
  path: "/tools/upscale",
  body: {
    apikey: "string",
    image: "image"
  },

  async run(req, res) {
    try {
      let { apikey, image } = req.body;

      if (!apikey || !global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }
      
      if (req.files && req.files.length > 0) {
        image = req.files[0].buffer;
      }

      if (!image) {
        return res.json({ status: false, error: "Image wajib diisi" });
      }

      // 🔥 PENTING: balikin ke Buffer
      const imageBuffer = Buffer.isBuffer(image)
        ? image
        : Buffer.from(image.data ?? image);

      const result = await uploadImageToCloudinary(imageBuffer);

      return res.json({
        status: true,
        result
      });
    } catch (e) {
      console.error("Upscaler Error:", e);
      res.status(500).json({
        status: false,
        error: e.message
      });
    }
  }
};