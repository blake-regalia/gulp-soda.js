# gulp-soda

A config-oriented paradigm for storing gulp build tasks as re-usable 'recipes', i.e. task scripts, in a single directory top from your module's root. Super tasks are automatically derived by grouping together low-level tasks under certain categories.

All gulp and vinyl plugins are automatically `require`d and passed to each 'recipe' by scanning the local package.json's `devDependencies`.

This module is optimized for responsiveness; recipes are lazily loaded only once a dependent task is run by the user.

## Recipe dependency management
You can copy recipe examples from the web, place them in your `gulp/` directory, and then install their dependencies by running `gulp install`.

## Contents
 * [Example Usage](#example)
 * [Sample Recipes](recipe-examples/)
 * [**API Reference**](#reference)

## Install
```sh
$ npm i -D gulp-soda
```

## Example

Given the following project directory:
```
├─ dist.debug/                # unobfuscated (yet pre-compiled) code for debugging
├─ dist.min/                  # minified production output
├─ dist.web/                  # for running & serving webapp
├─ gulp/                      # gulp recipes
|   ├─ browserify.js          #  bundles front-end javascript
|   ├─ minify.js              #  minify javascript code for node.js
|   ├─ develop.js             #  watches source files and recompiles on changes
|   └─ ...                    
├─ lib/                       # all source files
|   ├─ server/                #  server-side node.js code
|   |   └─ module.js          #   entry point for module
|   ├─ webapp/                #  front-end webapp
|   |   └─ ...
|   └─ .../                   #  other types of builds
├─ node_modules/
├─ gulpfile.js                # where soda config lives
└─ package.json
```

#### gulpfile.js:
Specify which tasks to associate with your build targets by configuring them in `gulpfile.js`:
```js
const gulp = require('gulp');
const soda = require('gulp-soda');

soda(gulp, {
    // default paths for inputs (src), outputs (dest), and task scripts (recipes)
    src: 'lib',
    dest: 'dist.debug',
    recipes: 'gulp',
    
    // map each directory within './lib' to a (list of) target(s)
    inputs: {
        server: [  // an array maps a single input dir to multiple outputs
            'debug',  // 'debug' is the name of a target
            'production: dist.min',  // the colon `:` indicates a dest path 'dist.min' (to override the default)
        ],
        webapp: 'bundle: dist.web',
    },
    
    // define which task scripts (recipes) each compile target can perform
    targets: {
        debug: [
            // 'develop' is a recipe that watches and reruns the given tasks (e.g., copy)
            'develop: copy',
        ],
        production: [
            'minify',
        ],
        bundle: [
            // the first task is the default for that target
            '[all]: less jade browserify',  // using '[' ']' around the name creates a psuedo-task that simply runs its dependencies
            'less',
            'jade',
            'browserify',
            'develop: all',  // enables the task 'develop-webapp'
            'browser-sync: all',
        ],
    },
    
    // pass options to recipes (keys act as patterns to match recipe names)
    options: {
        '*': { port: 8080 },
        less: { watch: '**/*.less' },
        jade: { watch: '**/*.jade' },
        browserify: { watch: '**/*.js' },
    },
});
```

#### The task list:
Now, automatically, your gulp task list will look like this:
```
$ gulp --tasks

# --- global default ---
default
 ├─ server
 └─ webapp
 
# --- input dirs defaults ---
server
 ├─ develop-server
 └─ minify-server
webapp
 └─ all-webapp
 
# --- recipe-directed tasks ---
less
 └─ less-webapp
jade
 └─ jade-webapp
browserify
 └─ browserify-webapp
minify
 └─ minify-server
develop
 ├─ develop-server
 └─ develop-webapp

# --- intermediate task groups ---
minify-server
 └─ minify-server-production
develop-server
 └─ develop-server-debug
copy-server
 └─ copy-server-debug

# --- lowest level (most specific) tasks ---
minify-server-production
develop-server-debug
 └─ copy-server-debug
copy-server-debug
less-webapp
jade-webapp
browserify-webapp
all-webapp
 ├─ less-webapp
 ├─ jade-webapp
 └─ browserify-webapp
develop-webapp
 ├─ less-webapp
 ├─ jade-webapp
 └─ browserify-webapp
```

#### Recipes:

`develop.js` could look like this:
```js
const path = require('path');
module.exports = function(gulp, $, p_src) {
    // each dependency..
    this.deps.forEach((s_dep) => {
        // fetch task info of dependency
        let h_friend = this.friend(s_dep);
        
        // make glob path for files to watch
        let p_watch = path.join(h_friend.src, h_friend.options.watch || '**/*');

        // debug print using `gulp-util` plugin (automatically loaded via devDependencies)
        $.util.log($.util.colors.magenta(`watching ${p_watch}...`));

        // watch those files and run dependent task
        gulp.watch(p_watch, [s_dep]);
    });
};

// declares which third-party packages this recipe requires
module.exports.dependencies = [
    'gulp-util',
];
```

See [recipe-examples/](recipe-examples/) for more useful examples to get you started

## Reference

## For recipes:
Each recipe must export a function that supports the following parameters:
```js
function(gulp, $, src, dest[, cb]) {}
```
- `gulp` - the gulp object
- `$` - an object containing all gulp and vinyl plugins automatically loaded via your module's `package.json`'s `devDependencies` that start with 'gulp-' or 'vinyl-'. The keys on this object have had their first word and dash removed, and all subsequent dashes replaced with underscores.
    - e.g. `gulp-babel` would get loaded into `$.babel`, and `vinyl-source-stream` into `$.source_stream`
- `src` - relative path to the input directory given by the target, e.g. `lib/webapp`
    - > Note: if this task's options object includes a `.src` key, then that value is appended to this string
- `dest` - relative path to the output directory given by the target, e.g. `dist/webapp`
- `cb` - the optional gulp task callback function to perform asynchronous operations without returning a stream

#### this:
When exporting the recipe function, you should use the declarative `function` syntax so that `this` will have:
- `.task` - the name of this particular task, which is the name of the recipe appended with the name of the target
    - e.g. `this.task === 'browerify-webapp'`
- `.deps` - an array of the names of task dependencies that this task was instructed to build by the config
- `.options` - an object that receives any options set on this recipe, the target, and `*` from the gulpfile merged into a single hash
- `.config` - an object that is global to all tasks, which stores user-settings such as a local port number or endpoint url, etc.
- `.src_dir` - a string of the relative path to this recipe target's directory, (i.e., without the `.src` option appended from the `.options` object)
- `.sub_dest` - a function that returns the relative path to a different output directory under the provided destination directory
    - e.g. `this.sub_dest('other')` will return the relative path to a subdirectory named `other` under the destination directory. Calling `this.sub_dest('')` will simply return the output directory itself
- `.other(other_recipe)` - a function that returns the complete name of another task given the name of its recipe and the current target for the current task
    - e.g. `this.other('clean')` within the `transpile-main` task returns the string `'clean-main'`
- `.friend(other_task)` - a function you can call to get the info of another task, such as one of your recipe's dependencies
    - the object it returns has:
    - `.src` - relative path to the input directory given by the other task's target
    - `.dest` - relative path to the output directory given by the other task's target
    - `.deps` - an array of the names of task dependencies the other task was/will-be instructed to build
    - `.options` - options object of the other task


## For calling soda from `gulpfile.js`:
These are the defaults for the config object passed to soda:
```js
soda(gulp, {
    src: 'lib',  // relative path to use as prefix for calls to `gulp.src(...)`
    dest: 'dist',  // relative path to use as prefix for calls to `gulp.dest(...)`
    recipes: 'gulp',  // relative path to directory with recipes to load by name

    config: {
        // an object that is available to all tasks
        // while `.options` is task-oriented, `.config` is meant for user settings such as a local port number or endpoint url
    },
    
    plugins: {
        pattern: /^(gulp|vinyl)\-/,  // regex to filter which dev dependencies to load
        transform: (s_dep) => {  // function to transform plugin's file name to key name
            return s_dep.replace(/^(\w+)\-(.+)$/, '$2')
                .replace(/\-/g, '_');
        },
    },
    
    inputs: {
        // maps source directories to their transformation targets
        //   each key is the name of a subdirectory within the source directory (e.g., ./lib/*/)
        //   each value is either a:
        //       string that specifies which 'target' to use for this directory
        //       or an array of those strings to specify multiple outputs
        // e.g. :
        // webapp: 'bundle',
        //   OR, the target string may contain a colon `:` to manually specify the output dir(s)
        // e.g.:
        // main: ['debug: dist.debug', 'production: dist.min'],
    },
    
    targets: {
        // defines transformations by combining recipes
        //   each key is the name of a 'target'
        //   each value is an array of recipes to associate with this target
        // e.g.:
        // debug: ['copy', 'develop: copy'],
        //   the `:` denotes a space-delimited list of recipes to pass as dependencies
        //   you can make pseudo-targets by using square brackets[] around the name
        // e.g.:
        // bundle: [ '[all]: less jade browserify', 'less', ... ],
        //   which is useful for creating tasks that simply run their dependencies
    },
    
    options: {
        // passes options to recipes via `this.options`
        //   each key is a task-pattern that specifies which recipe(s) to give options to
        //   each value is an object whose keys will be made available to the recipe under `this.options`
        '*': {
            // anything in here will be available to all recipes under `this.options` unless overriden by a recipe or full target option
        },
        //   using a recipe name as a key will make the object's keys available for any of those recipes
        //   using a full target as a key will make the object's keys available for only that specific task
        // [full target options] override [recipe options] override [* options]
        // if there is a `.src` key present in the options of any task, it will be appended to the `src` argument when that task is run
    },
    
    aliases: {
        // calls gulp.task(key, value) to make aliases for a task or group of tasks
        //   each key is the name of a new task to make
        //   each value is the dependency arg to pass to gulp.task()
    },
});
```

