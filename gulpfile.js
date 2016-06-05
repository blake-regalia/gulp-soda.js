
// gulp
const gulp = require('gulp');
const del = require('del');

// load gulp plugins
const plugins = require('gulp-load-plugins');
const $ = plugins();

// defaults
const P_SRC = 'lib/soda.js';
const P_DEST = 'dist';


// clean es5 dist
gulp.task('clean-es5', () => {
	return del.sync([P_DEST+'.es5']);
});

// clean es6 dist
gulp.task('clean-es6', () => {
	return del.sync([P_DEST+'.es6']);
});


// build es5 version
gulp.task('build-es5', ['clean-es5'], () => {

	// load tasker source file
	return gulp.src(P_SRC)

		// handle uncaught exceptions thrown by any of the plugins that follow
		.pipe($.plumber())

		// lint source file
		.pipe($.eslint())
		.pipe($.eslint.format())

		// preserve mappings to source files for debugging
		.pipe($.sourcemaps.init())

			// transpile
			.pipe($.babel())
		.pipe($.sourcemaps.write())

		// output
		.pipe(gulp.dest(P_DEST+'.es5'));
});

// build es6 version
gulp.task('build-es6', ['clean-es6'], () => {

	// load tasker source file
	return gulp.src(P_SRC)

		// handle uncaught exceptions thrown by any of the plugins that follow
		.pipe($.plumber())

		// lint source file
		.pipe($.eslint())
		.pipe($.eslint.format())

		// output
		.pipe(gulp.dest(P_DEST+'.es6'));
});


// build both versions
gulp.task('build', ['build-es5', 'build-es6']);


// default
gulp.task('default', ['build']);
