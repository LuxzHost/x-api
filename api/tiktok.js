const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const delay = ms => new Promise(r => setTimeout(r, ms));

async function ssstt(tiktokUrl) {
  const url = encodeURIComponent(tiktokUrl);

  const sig = await fetch(
    `https://ssstt.io/gnstre?url=${url}`
  ).then(r => r.json());

  if (!sig.signature) throw new Error("Gagal ambil signature");

  const create = await fetch(
    `https://a.ssstt.io/c?url=${url}&signature=${sig.signature}&timestamp=${sig.timestamp}`
  ).then(r => r.json());

  if (!create.photo_id && !create.video_id)
    throw new Error("Media ID tidak ditemukan");

  let res;
  while (true) {
    res = await fetch(
      `https://a.ssstt.io/p/${create.video_id || create.photo_id}`
    ).then(r => r.json());

    if (res.message === "completed") break;
    await delay(1500);
  }

  const meta = res.metadata || {};

  const base = {
    id: meta.id,
    caption: meta.t,
    author: meta.nn,
    username: meta.at,
    audio: meta.m,
    type: meta.ctt // photo | video
  };

  if (meta.ctt === "photo") {
    return {
      ...base,
      slide: meta.i || []
    };
  }

  if (meta.ctt === "video") {
    return {
      ...base,
      video: meta.u
    };
  }

  return base;
}


module.exports = [
  {
    name: "Tiktok",
    desc: "Tiktok downloader",
    category: "Downloader",
    path: "/download/tiktok?apikey=&url=",
    async run(req, res) {
      const { url, apikey } = req.query;

      if (!apikey || !global.apikey.includes(apikey)) {
        return res.json({
          status: false,
          error: "Apikey invalid"
        });
      }

      if (!url) {
        return res.json({
          status: false,
          error: "Url is required"
        });
      }

      try {
        const result = await ssstt(url);

        return res.json({
          status: true,
          result
        });
      } catch (err) {
        return res.status(500).json({
          status: false,
          error: err.message || err
        });
      }
    }
  }
];