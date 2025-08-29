const gulp = require('gulp');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
require('dotenv').config();

// Build task for Netlify
gulp.task('build', () => {
  return gulp.src('config.js')
    .pipe(replace("process.env.GROQ_API_KEY || ''", `'${process.env.GROQ_API_KEY || ''}'`))
    .pipe(replace("process.env.GOOGLE_API_KEY || ''", `'${process.env.GOOGLE_API_KEY || ''}'`))
    .pipe(gulp.dest('.'));
});

// Development server
gulp.task('serve', () => {
  const server = require('http-server').createServer();
  server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
  });
});
