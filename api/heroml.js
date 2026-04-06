const axios = require("axios");

const API = "https://mobile-legends.fandom.com/api.php";

async function getHeroesFast() {
  const { data } = await axios.get(API, {
    params: {
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Heroes",
      cmlimit: 500,
      format: "json"
    }
  });

  return data.query.categorymembers
    .map(h => h.title)
    .filter(h => !h.includes("/"));
}

async function getFirstAudioFast(hero) {
  const { data } = await axios.get(API, {
    params: {
      action: "parse",
      page: `${hero}/Audio/id`,
      prop: "images",
      format: "json"
    }
  });

  const audio = data.parse.images.find(x => x.endsWith(".ogg"));
  if (!audio) return null;

  // ambil url file
  const file = await axios.get(API, {
    params: {
      action: "query",
      titles: `File:${audio}`,
      prop: "imageinfo",
      iiprop: "url",
      format: "json"
    }
  });

  const page = Object.values(file.data.query.pages)[0];
  return page.imageinfo?.[0]?.url || null;
}


module.exports = {
  name: "Hero ML",
  desc: "Random sound hero Mobile Legends",
  category: "Random",
  path: "/random/heroml?apikey=",
  async run(req, res) {
    const { apikey } = req.query;
    if (!apikey || !global.apikey.includes(apikey)) {
      return res.json({ status: false, error: "Apikey invalid" });
    }

    try {
      const heroes = await getHeroesFast();
  let hero = heroes[Math.floor(Math.random() * heroes.length)];
  while (true) {
  if (hero.includes(":")) {
  hero = heroes[Math.floor(Math.random() * heroes.length)]
  } else {
  break
  }
  }
  const audio = await getFirstAudioFast(hero);

      if (!audio) return res.json({ status: false, error: "Audio hero tidak ditemukan" });

      res.json({
        status: true,
        hero,
        audio
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ status: false, error: error.message });
    }
  }
};