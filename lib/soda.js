
// native imports
const path = require('path');

/**
* defaults:
**/

// regex to filer which plugins to laod
const R_PLUGINS = /^(gulp|vinyl)\-/;

// transform plugin name to hash key
const F_TRANSFORM = (s_dep) => {

	// strip first word from plugin name
	return s_dep.replace(/^(\w+)\-(.+)$/, '$2')

		// replace hyphens with underscore
		.replace(/\-/g, '_');
};

// directory relative from root where...
const S_SRC_DIR = 'lib'; //...source files are
const S_DEST_DIR = 'dist'; //...build output goes
const S_RECIPE_DIR = 'gulp'; //...gulp task recipes are


//
const error = (s_msg, e_error=false) => {
	if(!e_error) {
		e_error = new Error();
		e_error.stack = 'Error:\n'+s_msg;
	}
	else {
		e_error.stack = 'Error:\n'+s_msg+'\n\n'+e_error.stack;
	}
	throw e_error;
};


/**
* main:
**/
module.exports = function(gulp, h_config={}) {

	/**
	* load plugins:
	**/

	// ref gulpfile dir (project root)
	let p_root = path.dirname(module.parent.parent.filename);

	// plugin options
	let h_plugin_options = h_config.plugins || {};

	// ref plugin regex
	let r_plugins = h_plugin_options.pattern || R_PLUGINS;

	// ref plugin transform
	let f_transform = h_plugin_options.transform || F_TRANSFORM;


	// prep plugins hash
	let h_plugins;

	// prep devDependencies hash
	let h_dev_dependencies = {};

	// load plugins
	const plugins = () => {
		// not yet cached
		if(!h_plugins) {
			// make plugins hash
			h_plugins = {};

			// load module's package.json
			h_dev_dependencies = require(path.join(p_root, 'package.json')).devDependencies;

			// fetch dev dependencies from package.json
			Object.keys(h_dev_dependencies)
				// each gulp plugin (or whatever matches the regex)
				.forEach((s_dep) => {

					// found gulp plugin
					if(r_plugins.test(s_dep)) {

						// skip loading this package
						if('gulp-soda' === s_dep) return;

						// make npm require path to plugin
						let p_plugin = path.join(p_root, 'node_modules', s_dep);

						// transform name to key, load plugin into hash
						h_plugins[f_transform(s_dep)] = require(p_plugin);
					}
				});
		}

		return h_plugins;
	};


	/**
	* load recipes:
	**/

	// ref recipe dir
	let s_recipe_dir = h_config.recipes || S_RECIPE_DIR;

	// ref recipe directory
	let p_recipe_dir = path.join(p_root, s_recipe_dir);


	/**
	* make tasks:
	**/

	// prep task info hash
	let h_task_info = {};

	// ref global config
	let h_global_config = h_config.config || {};

	// ref domain & range
	let h_domain = h_config.domain || {};
	let h_range = h_config.range || {};

	// ref src and dest root
	let s_src_dir = h_config.src || S_SRC_DIR;
	let s_dest_dir = h_config.dest || S_DEST_DIR;

	// ref options
	let h_options = h_config.options || {};

	// prep task lists hash
	let h_task_lists = {};

	// track empty task dependencies
	let h_empty_tasks = {};


	// each dir target in domain
	for(let s_dir in h_domain) {

		// ref range
		let a_range = h_domain[s_dir];

		// assure range is array
		if('string' === typeof a_range) a_range = [a_range];

		// prep list of defaults for directory task list
		let a_defaults = [];

		// prep groups hash for gourping same names of different outputs
		let h_groups = {};

		// each range in array
		a_range.forEach((s_range_target) => {

			// extract labels from range target
			let [s_range, s_task_dest_dir] = s_range_target.split(/\s*[:\s]\s*/);

			// ref recipe list
			let a_recipe_list = h_range[s_range];

			// create src and dest paths
			let p_src = path.join(s_src_dir, s_dir);
			let p_dest = path.join(s_task_dest_dir || s_dest_dir, s_dir);

			// each recipe
			a_recipe_list.forEach((s_recipe_target, i_recipe) => {

				// extract recipe name and its dependencies from target string
				let [s_recipe, ...a_deps] = s_recipe_target.split(/\s*[:\s]\s*/g);

				// task is empty (no recipe)
				let b_empty_task = '[' === s_recipe[0];
				if(b_empty_task) {
					s_recipe = s_recipe.slice(1, -1);
				}

				// make task name
				let s_task = `${s_recipe}-${s_dir}`;

				// ref task name mod
				let s_task_mod = '';

				// there are multiple ranges
				if(a_range.length > 1) {
					//	shift task name to group name
					let s_group = s_task;

					// ref group
					let a_group = h_groups[s_group] || (h_groups[s_group] = []);

					// create distinguished task name
					s_task_mod = `-${s_range}`;
					s_task += s_task_mod;

					// add this task name to the group
					a_group.push(s_task);
				}

				// this recipe is 0th target in domain, add it to the defaults
				if(0 === i_recipe) {
					a_defaults.push(s_task);
				}

				// make dpes for this task
				let a_task_deps = a_deps.map(s_dep => `${s_dep}-${s_dir}`+s_task_mod);
				a_task_deps.forEach((s_other_task, i_other_task) => {
					// ref empty task's dependencies if exists
					let a_empty_deps = h_empty_tasks[s_other_task];

					// it actually is an empty task
					if(a_empty_deps) {
						// append all its dependencies to this list
						a_task_deps.push(...a_empty_deps);

						// remove dependency to empty task
						a_task_deps.splice(i_other_task, 1);
					}
				});

				// make options hash for this task, save to persistent options hash
				let h_task_options = Object.assign({},
					h_options['*'] || {},
					h_options[s_recipe] || {},
					h_options[s_task] || {});

				// make src glob
				let p_task_src = path.join(p_src, h_task_options.src || '');

				// save to task info
				h_task_info[s_task] = {
					src: p_task_src,
					dest: p_dest,
					deps: a_task_deps,
					options: h_task_options,
				};

				// dependencies-only recipe; make task
				if(b_empty_task) {
					h_empty_tasks[s_task] = a_task_deps;
					return gulp.task(s_task, a_task_deps);
				}

				// make task, such that only once it is called do we make moves
				gulp.task(s_task, a_task_deps, (f_done_task) => {

					// only once this task is called, load the recipe script
					let f_recipe;
					try { f_recipe = require(path.join(p_recipe_dir, s_recipe)+'.js'); }
					catch(e_load_recipe) {
						if('MODULE_NOT_FOUND' === e_load_recipe.code) {
							error(`no such recipe "${s_recipe}" found in recipe directory "${s_recipe_dir}" {${path.join(p_recipe_dir, s_recipe)+'.js'}}`);
						}
						else {
							error(`script recipe "${s_recipe}" has a syntax/runtime error:`, e_load_recipe);
						}
					}

					// recipe is kind enough to require plugins
					if(f_recipe.plugins) {
						// make plugins hash
						plugins();

						// check each plugin
						f_recipe.plugins.forEach((s_plugin) => {
							// plugin is missing from devDependencies
							if(!h_dev_dependencies[s_plugin]) {
								console.error(`\nWARNING: the "${s_recipe}" recipe was kind enough to declare that it requires the "${s_plugin}" plugin to function properly; you currently do NOT have such a plugin listed in your package.json's devDependencies. This could be the reason for any errors you are getting\n`);
							}
						});
					}

					// forward control to recipe
					let z_return = f_recipe.apply({
						// source directory
						src_dir: p_src,

						// set sub directory destination within destination dir
						sub_dest: (s_sub_dir) => path.join(s_task_dest_dir || s_dest_dir, s_sub_dir),

						// config settings
						config: h_global_config,

						// task name
						task: s_task,

						// task dependencies
						deps: a_task_deps,

						// task options
						options: h_task_options,

						// allow recipe to ref other dependencies
						other: (s_dep) => `${s_dep}-${s_dir}`+s_task_mod,

						// allow recipe to ref other src
						friend: (s_dep) => h_task_info[s_dep],
					}, [gulp, plugins(), p_task_src, p_dest, f_done_task]);

					// recipe did not ask for async callback
					if(!z_return && f_recipe.length <= 4) {
						// callback on next event loop pass
						setImmediate(() => {
							f_done_task();
						});
					}

					// return whatever recipe did
					return z_return;
				});

				// ref corresponding task list
				let a_task_list = h_task_lists[s_recipe];

				// corresponding task list does not yet exist; create it
				if(!a_task_list) a_task_list = h_task_lists[s_recipe] = [];

				// append task name to its corresponding task list
				a_task_list.push(s_task);
			});
		});

		// there are multiple outputs
		for(let s_group_name in h_groups) {
			// create task group
			gulp.task(s_group_name, h_groups[s_group_name]);
		}

		// create defaults task group
		gulp.task(s_dir, a_defaults);
	}


	/**
	* append shortcut tasks:
	**/

	// build default tasks for each type
	for(let s_general_task in h_task_lists) {
		let a_deps = h_task_lists[s_general_task];

		// link dependencies to trigger those tasks
		gulp.task(s_general_task, a_deps);
	}


	// ref aliases from config
	let h_aliases = h_config.aliases;

	// add aliases
	Object.keys(h_aliases || {}).forEach((s_alias) => {
		let a_tasks = h_aliases[s_alias];

		// register alias task
		gulp.task(s_alias, a_tasks);
	});


	// register default task
	gulp.task('default', Object.keys(h_domain));
};
