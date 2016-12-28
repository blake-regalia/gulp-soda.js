const pug = require('pug');

module.exports = function(gulp, $, p_src, p_dest) {
	// build stream
	return gulp.src([
		p_src+'/**/*.pug',
	])
		// handle uncaught exceptions thrown by any of the plugins that follow
		.pipe($.plumber())

		// show which files are being processed
		.pipe($.debug())

		// compile pug => html
		.pipe($.pug({
			pug: pug,
			pretty: true,
			locals: {
				site: {
					// data: h_site_data,
				},
			},
		}))

		// rename if options has function
		.pipe($.rename((...a_args) => {
			if(this.options.rename) this.options.rename(...a_args);
		}))

		// write to output directory
		.pipe(gulp.dest(p_dest));
};

module.exports.dependencies = [
	'pug',
	'gulp-plumber',
	'gulp-debug',
	'gulp-pug',
	'gulp-rename',
];
