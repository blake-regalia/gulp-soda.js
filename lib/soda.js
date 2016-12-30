
// native imports
const fs = require('fs');
const path = require('path');

// third-party modules
const install = require('npm-install-package');
const semver = require('semver');

// gulp plugins
const gutil = require('gulp-util');

/**
* defaults:
**/

// regex to filer which plugins to laod
const R_PLUGINS = /^(gulp|vinyl)\-/;

// package w/ semvar
const R_PACKAGE = /^([^\s@]+)(?:@(.+)|)$/;

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

	// reigster a gulp task
	const register = (s_task, ...a_args) => {
		// reserved task names
		if('install' === s_task) {
			error(`'${s_task}' is a reserved task name.`);
		}

		// register task
		gulp.task(s_task, ...a_args);
	};


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

						// skip loading this package and soda plugins
						if('gulp-soda' === s_dep || s_dep.startsWith('gulp-soda-')) return;

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

	// ref inputs & range
	let h_inputs = h_config.inputs || h_config.domain || {};
	let h_targets = h_config.targets || h_config.range || {};

	// ref src and dest root
	let s_src_dir = h_config.src || S_SRC_DIR;
	let s_dest_dir = h_config.dest || S_DEST_DIR;

	// ref options
	let h_options = h_config.options || {};

	// prep task lists hash
	let h_task_lists = {};

	// track empty task dependencies
	let h_empty_tasks = {};


	// each dir target in inputs
	for(let s_dir in h_inputs) {

		// ref targets
		let a_targets = h_inputs[s_dir];

		// assure targets is array
		if('string' === typeof a_targets) a_targets = [a_targets];

		// prep list of defaults for directory task list
		let a_defaults = [];

		// prep groups hash for grouping same names of different outputs
		let h_groups = {};

		// each targets in array
		a_targets.forEach((s_target) => {

			// extract labels from target
			let [s_range, s_task_dest_dir] = s_target.split(/\s*[:\s]\s*/);

			// ref recipe list
			let a_recipe_list = h_targets[s_range];

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

				// there are multiple targets
				if(a_targets.length > 1) {
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

				// this recipe is 0th target in inputs, add it to the defaults
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
					return register(s_task, a_task_deps);
				}

				// make task, such that only once it is called do we make moves
				register(s_task, a_task_deps, (f_done_task) => {

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

					// recipe is kind enough to indicate its dependencies
					if(f_recipe.dependencies) {
						// make plugins hash
						plugins();

						// check each dependency
						f_recipe.dependencies.forEach((s_plugin) => {
							// dependency is missing from devDependencies
							if(!h_dev_dependencies[s_plugin]) {
								gutil.log(gutil.colors.yellow(`the "${s_recipe}" recipe requires the "${s_plugin}" plugin to function properly; you currently do NOT have that module listed in your package.json's devDependencies. This could be the reason for any errors you are getting`));
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
			register(s_group_name, h_groups[s_group_name]);
		}

		// create defaults task group
		register(s_dir, a_defaults);
	}


	/**
	* append shortcut tasks:
	**/

	// build default tasks for each type
	for(let s_general_task in h_task_lists) {
		let a_deps = h_task_lists[s_general_task];

		// link dependencies to trigger those tasks
		register(s_general_task, a_deps);
	}


	// ref aliases from config
	let h_aliases = h_config.aliases;

	// add aliases
	Object.keys(h_aliases || {}).forEach((s_alias) => {
		let a_tasks = h_aliases[s_alias];

		// register alias task
		register(s_alias, a_tasks);
	});


	// register default task
	register('default', Object.keys(h_inputs));


	// installs packages from recipe dependencies
	const install_packages = (h_opts={}) => {
		// set of plugins' dependencies
		let h_plugins_dependencies = {};

		// scan recipe dir
		fs.readdir(p_recipe_dir, (e_scan, a_files) => {
			if(e_scan) error('failed to scan recipe directory: '+e_scan);

			// each file in directory
			a_files.forEach((s_file) => {
				// read file contents into memory
				let s_contents = fs.readFileSync(path.join(p_recipe_dir, s_file), 'utf8');

				// simulate module load
				let h_module_sim = eval(`
					(function(exports, require, module, __filename, __dirname) {
						${s_contents}
						return module;
					})(exports, function(){}, Object.assign({}, module), __filename, __dirname);
				`);

				// add each dependency to the set
				let a_dependencies = h_module_sim.exports.dependencies;
				if(a_dependencies) {
					a_dependencies.forEach((s_dependency) => {
						let a_sources = h_plugins_dependencies[s_dependency] = h_plugins_dependencies[s_dependency] || [];
						a_sources.push(s_file);
					});
				}
			});

			// load module's package.json
			h_dev_dependencies = require(path.join(p_root, 'package.json')).devDependencies;

			// list of packages to install
			let a_installs = [];

			// check all dependencies are met
			for(var s_dependency in h_plugins_dependencies) {
				let a_sources = h_plugins_dependencies[s_dependency];

				// extract package name & dependency range
				let m_package = R_PACKAGE.exec(s_dependency);
				if(!m_package) {
					gutil.log(gutil.colors.yellow(`failed to interpret package name "${s_dependency}" referenced in: ${a_sources.join(', ')}`));
					return;
				}

				// ref package name
				let s_package_name = m_package[1];

				// package not found in dev dependency
				if(!h_dev_dependencies[s_package_name]) {
					// add package to list of installs
					a_installs.push(s_dependency);
				}
				// package exists in node_modules and dependency requires certain version(s)
				else if(m_package[2]) {
					// fetch package's version
					let s_version = require(path.join(p_root, 'node_modules', s_dependency, 'package.json')).version;

					// ref semantic version requirement of dependency
					let s_semver = m_package[2];

					// current version of package does not satisfy semver requirement of plugin
					if(!semver.satisfies(s_version, s_semver)) {
						gutil.log(gutil.colors.yellow(`currently installed version of '${s_dependency}' (v${s_version}) is not satisfied by semantic version requirement ${s_semver} referenced in: ${a_sources.join(', ')}.`));
					}
				}
			}

			// install dependencies
			if(a_installs.length) {
				gutil.log('installing packages: '+a_installs.join(', ')+'...');
				install(a_installs, h_opts, (e_install) => {
					if(e_install) {
						error('failed to install packages: '+e_install);
					}
					else {
						gutil.log('successfully installed '+a_installs.length+' packages');
					}
				});
			}
			else {
				gutil.log('all plugin dependencies met');
			}
		});
	};


	// register install task
	gulp.task('install', () => {
		install_packages({saveDev: true});
	});
};
