module.exports = {
  apps: [{
    name: "realtime",
    script: "./src/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
  }]
};