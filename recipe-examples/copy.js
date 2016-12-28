const path = require('path');

// make task
module.exports = function(gulp, $, p_src, p_dest) {

	// open read stream on source
	gulp.src(path.join(p_src, this.options.src || '**/*'))

		// optional rename
		.pipe($.rename((...a_args) => {
			if(this.options.rename) this.options.rename(...a_args);
		}))

		// output
		.pipe(gulp.dest(p_dest));
};

// ensure that anyone reusing this recipe has the requisite devDependencies
module.exports.dependencies = [
	'gulp-rename',
];
