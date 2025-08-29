const gulp = require('gulp');
const replace = require('gulp-replace');
const rename = require('gulp-rename');
require('dotenv').config();

// Build task for production deployment
gulp.task('build', () => {
  return gulp.src('config.js')
    .pipe(replace('{{GROQ_API_KEY}}', process.env.GROQ_API_KEY || ''))
    .pipe(replace('{{GOOGLE_API_KEY}}', process.env.GOOGLE_API_KEY || ''))
    .pipe(gulp.dest('.'));
});

// Development build task
gulp.task('build:dev', gulp.parallel(
  () => {
    return gulp.src('config.js')
      .pipe(replace('{{GROQ_API_KEY}}', process.env.GROQ_API_KEY || ''))
      .pipe(replace('{{GOOGLE_API_KEY}}', process.env.GOOGLE_API_KEY || ''))
      .pipe(rename('config.dev.js'))
      .pipe(gulp.dest('.'));
  },
  () => {
    return gulp.src('index.html')
      .pipe(replace('config.js', 'config.dev.js'))
      .pipe(rename('index.dev.html'))
      .pipe(gulp.dest('.'));
  }
));

// Development server with build
gulp.task('serve', gulp.series('build:dev', () => {
  const httpServer = require('http-server');
  const server = httpServer.createServer({
    root: '.',
    cache: -1
  });
  server.listen(8080, () => {
    console.log('Server running on http://localhost:8080/index.dev.html');
  });
}));
