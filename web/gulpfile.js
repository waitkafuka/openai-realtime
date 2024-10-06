const gulp = require('gulp');
const through2 = require('through2');
const htmlmin = require('gulp-htmlmin');
const terser = require('terser');
const CleanCSS = require('clean-css');

function minifyHTML() {
    return gulp.src('./src/*.html')
        .pipe(through2.obj(function (file, enc, cb) {
            // If file is null or stream, pass it through
            if (file.isNull()) {
                return cb(null, file);
            }
            if (file.isStream()) {
                this.emit('error', new PluginError('minifyHTML', 'Streaming not supported'));
                return cb();
            }

            // Get file contents as string
            let contents = file.contents.toString();

            const scriptRegex = /<script>([\s\S]*?)<\/script>/gi;
            const styleRegex = /<style>([\s\S]*?)<\/style>/gi;

            const promises = [];

            // Replace script tags with placeholders and collect promises
            contents = contents.replace(scriptRegex, function (match, p1) {
                const index = promises.length;
                const promise = terser.minify(p1).then(result => {
                    return `<script>${result.code}</script>`;
                });
                promises.push(promise);
                return `__SCRIPT_PLACEHOLDER_${index}__`;
            });

            // Replace and minify style tags synchronously
            contents = contents.replace(styleRegex, function (match, p1) {
                const minified = new CleanCSS().minify(p1).styles;
                return `<style>${minified}</style>`;
            });

            // After all promises are resolved, replace placeholders
            Promise.all(promises).then(replacements => {
                replacements.forEach((replacement, index) => {
                    const placeholder = `__SCRIPT_PLACEHOLDER_${index}__`;
                    contents = contents.replace(placeholder, replacement);
                });
                // Update file contents
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

// Watch task
function watchFiles() {
    gulp.watch('./src/*.html', minifyHTML);
}

// Export tasks
exports.default = gulp.series(minifyHTML, watchFiles);
exports.minify = minifyHTML;
exports.watch = watchFiles;