const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 8000;

const upload = multer();

app.enable("trust proxy");
app.set("json spaces", 2);

app.use(express.static(path.join(__dirname, 'src')));
app.use(express.json());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cors());

global.getBuffer = async (url, options = {}) => {
  try {
    const res = await axios({ method: 'get', url, headers: { 'DNT': 1, 'Upgrade-Insecure-Request': 1 }, ...options, responseType: 'arraybuffer' });
    return res.data;
  } catch (err) { return err; }
};

global.fetchJson = async (url, options = {}) => {
  try {
    const res = await axios({ method: 'GET', url, headers: { 'User-Agent': 'Mozilla/5.0' }, ...options });
    return res.data;
  } catch (err) { return err; }
};

const settings = {
  name: "LuxzOffc Api's",
  description: "LuxzOffc Api is a simple and lightweight REST API built with Express.js",
  apiSettings: { creator: "luxzopicial", apikey: ["new", "new", "luxz"] },
  linkWhatsapp: "https://wa.me/628131164107",
  linkYoutube: "https://www.youtube.com/@Luxz-Dev02"
};

global.apikey = settings.apiSettings.apikey;

app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (data) {
    if (data && typeof data === 'object') {
      const responseData = { status: data.status, creator: settings.apiSettings.creator || "Created Using Skyzopedia", ...data };
      return originalJson.call(this, responseData);
    }
    return originalJson.call(this, data);
  };
  next();
});

let totalRoutes = 0;
let rawEndpoints = {};

const apiFolder = path.join(__dirname, './api');

const register = (ep, file) => {
  if (ep && ep.name && ep.desc && ep.category && ep.path && typeof ep.run === "function") {
    const cleanPath = ep.path.split("?")[0];
    const method = ep.method ? ep.method.toLowerCase() : 'get';
    
    if (method === 'post') {
      app.post(cleanPath, upload.any(), (req, res, next) => {
        console.log(`POST ${cleanPath} - Body:`, req.body);
        console.log(`POST ${cleanPath} - Files:`, req.files);
        ep.run(req, res, next);
      });
    } else {
      app.get(cleanPath, (req, res, next) => {
        console.log(`GET ${cleanPath} - Query:`, req.query);
        ep.run(req, res, next);
      });
    }

    if (!rawEndpoints[ep.category]) rawEndpoints[ep.category] = [];
    
    const endpointData = {
      name: ep.name,
      desc: ep.desc,
      path: ep.path,
      method: ep.method || 'GET',
      ...(ep.innerDesc ? { innerDesc: ep.innerDesc } : {}),
      ...(ep.body ? { body: ep.body } : {})
    };
    
    rawEndpoints[ep.category].push(endpointData);
    totalRoutes++;
    console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Loaded Route: ${file} → ${ep.name} (${method.toUpperCase()}) `));
  }
};

fs.readdirSync(apiFolder).forEach((file) => {
  const filePath = path.join(apiFolder, file);
  if (path.extname(file) === '.js') {
    try {
      delete require.cache[require.resolve(filePath)];
      const routeModule = require(filePath);
      if (Array.isArray(routeModule)) {
        routeModule.forEach(ep => register(ep, file));
      } else if (routeModule.endpoint) {
        register(routeModule.endpoint, file);
      } else if (typeof routeModule === "function") {
        routeModule(app);
      } else {
        register(routeModule, file);
      }
    } catch (err) {
      console.error(chalk.red(`Error loading ${file}:`), err.message);
    }
  }
});

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));

app.get('/settings', (req, res) => {
  const endpoints = {
    categories: Object.keys(rawEndpoints)
      .sort((a, b) => a.localeCompare(b))
      .map(category => ({
        name: category,
        items: rawEndpoints[category].sort((a, b) => a.name.localeCompare(b.name))
      }))
  };
  settings.categories = endpoints.categories;
  res.json(settings);
});

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/docs.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src/home.html'));
});

app.listen(PORT, () => {
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
});

module.exports = app;
