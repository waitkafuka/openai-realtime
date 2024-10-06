const gulp = require('gulp');
const through2 = require('through2');
const htmlmin = require('gulp-htmlmin');
const terser = require('terser');
const CleanCSS = require('clean-css');
const replace = require('gulp-replace');
require('dotenv').config();

// 删除单独的 inject-env 任务，因为我们将其集成到 minifyHTML 中

function minifyHTML() {
    return gulp.src('./src/*.html')
        .pipe(through2.obj(function (file, enc, cb) {
            // 如果文件为 null 或 stream，直接传递
            if (file.isNull()) {
                return cb(null, file);
            }
            if (file.isStream()) {
                this.emit('error', new PluginError('minifyHTML', 'Streaming not supported'));
                return cb();
            }

            // 获取文件内容为字符串
            let contents = file.contents.toString();

            // 注入环境变量
            contents = contents.replace('%%WS_SERVER_URL%%', process.env.WS_SERVER_URL);

            const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
            const styleRegex = /<style>([\s\S]*?)<\/style>/gi;

            const promises = [];

            // 替换脚本标签为占位符并收集 promises
            contents = contents.replace(scriptRegex, function (match, p1) {
                const index = promises.length;
                const promise = terser.minify(p1).then(result => {
                    return `<script>${result.code}</script>`;
                });
                promises.push(promise);
                return `__SCRIPT_PLACEHOLDER_${index}__`;
            });

            // 替换并压缩样式标签
            contents = contents.replace(styleRegex, function (match, p1) {
                const minified = new CleanCSS().minify(p1).styles;
                return `<style>${minified}</style>`;
            });

            // 所有 promises 解决后，替换占位符
            Promise.all(promises).then(replacements => {
                replacements.forEach((replacement, index) => {
                    const placeholder = `__SCRIPT_PLACEHOLDER_${index}__`;
                    contents = contents.replace(placeholder, replacement);
                });
                // 更新文件内容
                file.contents = Buffer.from(contents);
                cb(null, file);
            }).catch(err => {
                cb(err);
            });
        }))
        .pipe(htmlmin({
            collapseWhitespace: true,
            removeComments: true
        }))
        .pipe(gulp.dest('./dist'));
}

// Watch 任务
function watchFiles() {
    gulp.watch('./src/*.html', minifyHTML);
}

// 导出任务
exports.default = gulp.series(minifyHTML);
exports.minify = minifyHTML;
exports.watch = watchFiles;