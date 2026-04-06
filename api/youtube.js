const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

function extractYouTubeId(input) {
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  const regex =
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = input.match(regex);
  return match ? match[1] : null;
}

function randomSig(length = 32) {
  const chars = "abcdef0123456789";
  let sig = "";
  for (let i = 0; i < length; i++) {
    sig += chars[Math.floor(Math.random() * chars.length)];
  }
  return sig;
}

async function ytdl(input, type = "mp3") {
  const videoId = extractYouTubeId(input);
  if (!videoId) throw new Error("Invalid YouTube URL / ID");

  const api = `https://d8.ymcdn.org/api/v1/convert?sig=${randomSig()}&v=${videoId}&f=${type}&_=${Math.random()}`;

  const res = await fetch(api, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 15; 23124RA7EO Build/AQ3A.240829.003) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.7499.192 Mobile Safari/537.36",
      "Accept-Encoding": "gzip, deflate, br, zstd",
      "origin": "https://id.ytmp3.mobi",
      "referer": "https://id.ytmp3.mobi/",
      "x-requested-with": "mark.via.gp"
    }
  });

  const json = await res.json();

  if (json.error !== 0 || !json.downloadURL) {
    throw new Error("Convert failed");
  }

  return {
    id: videoId,
    type,
    download: json.downloadURL,
    progress: json.progressURL
  };
}


module.exports = [
  {
    name: "Youtube Downloader",
    desc: "Youtube MP3 / MP4 Downloader",
    category: "Downloader",
    path: "/download/youtube?apikey=&url=&type=",
    async run(req, res) {
      const { apikey, url, type = "mp3" } = req.query;

      if (!global.apikey.includes(apikey)) {
        return res.json({ status: false, error: "Apikey invalid" });
      }

      if (!url) {
        return res.json({ status: false, error: "Url is required" });
      }

      if (!["mp3", "mp4"].includes(type)) {
        return res.json({
          status: false,
          error: "Type must be mp3 or mp4"
        });
      }

      try {
        const result = await ytdl(url, type);

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
  }
];