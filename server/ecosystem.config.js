module.exports = {
  apps: [{
    name: "realtime",
    script: "./index.js",
    instances: 1,
    autorestart: true,
    watch: false,
  }]
};