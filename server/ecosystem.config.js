module.exports = {
  apps: [{
    name: "realtime",
    script: "./src/index.js",
    instances: 1,
    autorestart: true,
    watch: false,
    // 添加日志配置
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    error_file: "./logs/realtime-error.log",
    out_file: "./logs/realtime-out.log",
    log_file: "./logs/realtime-combined.log",
    merge_logs: true,
    max_size: "10M",
    max_files: 10
  }]
};