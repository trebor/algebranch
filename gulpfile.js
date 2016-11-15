'use strict';

var _             = require('lodash');
var del           = require('del');
var browserSync   = require('browser-sync');
var gulp          = require('gulp');
var $             = require('gulp-load-plugins')();
var Server        = require('karma').Server;
var webpack       = require('webpack-stream');
var argv          = require('yargs').argv;
var runSequence   = require('run-sequence');
var webpackConfig = require('./webpack.config.js')();

// -------------------------------------------
// Configuration
// -------------------------------------------

// Make sure to install these dependencies before using express
//  npm install express --save-dev
//  npm install ejs --save-dev
//  npm install gulp-nodemon --save-dev
var USE_EXPRESS = false;
var SERVER_PORT = process.env.PORT || 7008;

// -------------------------------------------

var paths = {
  src:   __dirname + '/src',
  dist:  __dirname + '/dist',
  bower: __dirname + '/src/bower_components'
};

var patterns = {
  js          : paths.src + '/app/**/*.js',
  bower       : paths.src + '/bower_components/**/*.@(css|png|jpg|jpeg|tiff|gif|woff|woff2|ttf|otf|svg)',
  sass        : paths.src + '/app/**/*.scss',
  ngtemplates : paths.src + '/app/**/*.html',
  appJson     : paths.src + '/app/**/*.json',
  json        : paths.src + '/data/**/*.json',
  data        : paths.src + '/data/**/*.!(json)',
  assets      : paths.src + '/assets/**/*',
  appImages   : paths.src + '/app/**/*.@(png|gif|jpg|jpeg|tiff)',
  images      : paths.src + '/images/**/*',
  fonts       : paths.src + '/fonts/**/*',
  html        : paths.src + '/*.html'
};

gulp.task('clean', function () {
  return del([paths.dist + '/**/*']);
});

gulp.task('appJson', function(){
  var dest = paths.dist + '/app';
  return gulp.src(patterns.appJson)
    // .pipe($.newer(dest))
    // .pipe($.jsonminify())
    .pipe(gulp.dest(dest));
});

gulp.task('json', function(){
  var dest = paths.dist + '/data';
  return gulp.src(patterns.json)
    // .pipe($.newer(dest))
    // .pipe($.jsonminify())
    .pipe(gulp.dest(dest));
});

gulp.task('data', function(){
  var dest = paths.dist + '/data';
  return gulp.src(patterns.data)
    .pipe($.newer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task('assets', function(){
  var dest = paths.dist + '/assets';
  return gulp.src(patterns.assets)
    .pipe($.newer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task('fonts', function(){
  var dest = paths.dist + '/fonts';
  return gulp.src(patterns.fonts)
    .pipe($.newer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task('html', function(){
  var dest = paths.dist;
  return gulp.src(patterns.html)
    .pipe($.newer(dest))
    .pipe($.htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      conservativeCollapse: true
    }))
    .pipe(gulp.dest(dest));
});

gulp.task('bower', function(){
  var dest = paths.dist + '/bower_components';
  return gulp.src(patterns.bower)
    .pipe($.newer(dest))
    .pipe(gulp.dest(dest));
});

gulp.task('appImages', function(){
  var dest = paths.dist + '/app';
  return gulp.src(patterns.appImages)
    .pipe($.newer(dest))
    .pipe($.imagemin())
    .pipe(gulp.dest(dest));
});

gulp.task('images', function(){
  var dest = paths.dist + '/images';
  return gulp.src(patterns.images)
    .pipe($.newer(dest))
    .pipe($.imagemin())
    .pipe(gulp.dest(dest));
});

gulp.task('sass', function () {
  return gulp.src(patterns.sass)
    .pipe($.newer(paths.dist + '/app/main.css'))
    .pipe($.sass({outputStyle: 'compressed'}).on('error', $.sass.logError))
    .pipe(gulp.dest(paths.dist + '/app'));
});

gulp.task('ngtemplates', function () {
  return gulp.src(patterns.ngtemplates)
    .pipe($.newer(paths.dist + '/app/bundle.ngtemplates.js'))
    .pipe($.htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      conservativeCollapse: true
    }))
    .pipe($.ngTemplates({
      filename: 'bundle.ngtemplates.js',
      module: 'app.templates',
      standalone: true
    }))
    .pipe(gulp.dest(paths.dist + '/app'));
});

gulp.task('webpack', function() {
  return gulp.src(paths.src + '/app/main.js')
    .pipe(webpack(_.extend(webpackConfig, {
      output: {
        filename: 'bundle.js',
        sourceMapFilename: '[file].map'
      },
      devtool: argv.production ? undefined : 'eval'
    })))
    .pipe($.if(argv.production, $.uglify({
      report: 'min',
      mangle: false,
      compress: false, //true,
      preserveComments: false
    })))
    .pipe(gulp.dest(paths.dist + '/app'));
});

/* Run test once and exit */
gulp.task('test', function (done) {
  new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
});

/* Watch for file changes and re-run tests on each change */
gulp.task('tdd', function (done) {
  new Server({
    configFile: __dirname + '/karma.conf.js'
  }, done).start();
});

/* Start browser-sync */
gulp.task('browser-sync', ['server'], function() {
  if(USE_EXPRESS){
    browserSync.init({
      proxy: 'http://localhost:' + SERVER_PORT,
      files: ['dist/**/*.*', 'server/**/*.ejs'],
      browser: 'google chrome',
      port: 7000,
    });
  }
  else{
    browserSync.init({
      server: './dist',
      files: ['dist/**/*.*'],
      browser: 'google chrome',
      port: 7000,
    });
  }
});

gulp.task('server', ['build'], function (cb) {
  if(USE_EXPRESS){
    var started = false;
    $.nodemon({
      script: 'server.js',
      nodeArgs: argv.production ? ['--harmony'] : ['--debug', '--harmony'],
      ignore: ['node_modules/**', 'src/**/*', 'dist/**/*'],
      ext: 'js, ejs',
      env: {
        NODE_ENV: argv.production ? 'production' : 'development'
      }
    }).on('start', function () {
      if (!started) {
        cb();
        started = true;
      }
    });
  }
  else{
    cb();
  }
});

var buildTasks = [
  'bower',
  'sass',
  'ngtemplates',
  'appJson',
  'json',
  'assets',
  'data',
  'appImages',
  'images',
  'fonts',
  'html'
];

/* Build everything */
gulp.task('build', function(done){
  runSequence('clean', buildTasks.concat(['webpack']), done);
});

/* Watch for individual file changes and build as needed */
gulp.task('watch', ['build'], function(){
  buildTasks.forEach(function(task){
    gulp.watch(patterns[task], [task]);
  });

  gulp.watch(patterns.js, ['webpack']);
});

gulp.task('run', ['watch', 'browser-sync']);
gulp.task('default', ['run']);
