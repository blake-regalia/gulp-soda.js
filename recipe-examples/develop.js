const path = require('path');

module.exports = function(gulp, $, p_src, p_dest) {

	// each dependency
	a_deps.forEach((s_dep) => {

		// make glob path for files to watch
		let p_watch = path.join(p_src, this.options(s_dep).watch || '**/*');

		// debug print
		$.util.log($.util.colors.magenta(`watching ${p_watch}...`));

		// watch those files and run dependent task
		gulp.watch(p_watch, [s_dep]);
	});
};
