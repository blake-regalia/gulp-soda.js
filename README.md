# gulp-soda

A light-weight solution to store your build tasks as re-usable 'recipes', i.e. task scripts, in a gulp directory from your module's root. Tasks will be automatically generated for you with convenient names at various levels of abstraction via dependency-chaining.

Other gulp plugins are automatically loaded by scanning your package's `devDependencies` array and passed to each recipe when creating tasks.

`gulp-soda` is light-weight since the module itself has no dependencies. It is also optimized for responsiveness, so recipes are lazily required only once a task that needs it is run.


## Install
```sh
$ npm i -D gulp-soda
```

## Example

Your project root could look something like this
```
├─ dist/                      # generic production output
├─ dist.es5/                  # production output exclusively for es5
├─ dist.es6/                  # production output exclusively for es6
├─ gulp/                      # gulp recipes
|   ├─ transpile.js           #  a recipe for transpiling es6 => es5
|   └─ develop.js             #  a recipe to watch source files and recompile on changes
├─ lib/                       # all source files
|   ├─ server/                #  your module's export, perhaps
|   |   └─ module.js          #   entry point for module
|   ├─ webapp/                # another type of build (i.e., not just transpiling)
|   |   └─ ...
|   └─ .../                   # possibly other types of builds
├─ node_modules/
├─ gulpfile.js
├─ index.js                   # the entry point of your module, which routes to dist.es5/ or dist.es6/ depending on node version
└─ package.json
```

#### gulpfile.js:
Specify which tasks to associate with your build targets by configuring them in `gulpfile.js`:
```js
const gulp = require('gulp');
const soda = require('gulp-soda');

soda(gulp, {
    // these are the defaults for the following paths
    src: 'lib',
    dest: 'dist',
    recipes: 'gulp',
    
    // map subdirectories within './lib' to a range
    domain: {
        server: [  // an array maps a single input dir to multiple outputs
            'es5: dist.es5',  // the colon `:` indicates a dest dir to override the default
            'es6: dist.es6',
        ],
        webapp: 'bundle',
    },
    
    // group recipes into 'flavors'
    range: {
        es5: [
            'transpile',
            'develop: transpile',
        ],
        es6: [
            'copy',  // assuming we don't use import and export keywords of es6, no need to transpile
            'develop: copy',
        ],
        bundle: [
            // first task is default for that target
            '[all]: less jade browserify',  // using '[' ']' around the name creates an empty recipe that runs its dependencies
            'less',
            'jade',
            'browserify',
            'develop: all',
            'browser-sync: all',
        ],
    },
    
    // task options to pass to recipes (keys represent recipe patterns)
    options: {
        less: { watch: '**/*.less' },
        jade: { watch: '**/*.jade' },
        browserify: { watch: '**/*.js' },
    },
});
```

#### The task list:
Now, automatically, your gulp task list will look like this:
```
# --- global default ---
default
 ├─ server
 └─ webapp
 
# --- domain target defaults ---
server
 ├─ transpile-server-es5
 └─ copy-server-es6
webapp
 └─ all-webapp
 
# --- generic recipe tasks ---
less
 └─ less-webapp
jade
 └─ jade-webapp
browserify
 └─ browserify-webapp
transpile
 └─ transpile-server-es5
develop
 ├─ develop-server-es5
 ├─ develop-server-es6
 └─ develop-webapp
browser-sync
 └─ browser-sync-webapp

# --- intermediate task groups ---
transpile-server
 └─ transpile-server-es5
develop-server
 ├─ develop-server-es5
 └─ develop-server-es6
copy-server
 └─ copy-server-es6

# --- lowest level (most specific) tasks ---
transpile-server-es5
develop-server-es5
 └─ transpile-server-es5
copy-server-es6
develop-server-es6
 └─ copy-server-es6
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
browser-sync-webapp
 ├─ less-webapp
 ├─ jade-webapp
 └─ browserify-webapp
```

#### Those recipes:

Continuing the above example, `develop.js` could look like this:
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
```

And `transpile.js` could look like this:
```js
module.exports = function(gulp, $, p_src, p_dest) {
    // load all javascript source files
    return gulp.src(p_src+'/**/*.js')
        // lint all javascript source files
        .pipe($.eslint())
        .pipe($.eslint.format())

        // preserve mappings to source files for debugging
        .pipe($.sourcemaps.init())
            .pipe($.babel())  // transpile
        .pipe($.sourcemaps.write())

        // optionally rename output
        .pipe($.if(this.options.rename, $.rename(this.options.rename)))

        // write output to dist directory
        .pipe(gulp.dest(p_dest));
};

// optionally declares to gulp-soda which plugins this recipe uses
// (very polite in case others reuse this recipe, they will receive warnings if they are missing those plugins as devDependencies)
module.exports.plugins = ['gulp-eslint', 'gulp-sourcemaps', 'gulp-babel', 'gulp-if', 'gulp-rename'];
```

See [recipe-examples/](recipe-examples/) for more useful examples to get you started

## Reference

## For recipes:
Each recipe must export a function that supports the following parameters:
```js
function(gulp, $, src, dest[, cb]) {}
```
- `gulp` - the gulp object
- `$` - an object containing all gulp plugins automatically loaded via your module's `package.json`'s `devDependencies` that start with 'gulp-' or 'vinyl-'. The keys on this object have had their first word and dash removed, and all subsequent dashes replaced with underscores.
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
    
    domain: {
        // maps sub-directories to their recipe-list-type, i.e., their 'flavor'
        //   each key is the name of a directory within the source directory
        //   each value is either a:
        //       string that specifies which 'flavor' describes this target
        //       or an array of those strings to specify multiple outputs
        // e.g. :
        // webapp: 'bundle',
        //   the range target string may contain a colon `:` to indicate different output dirs
        // e.g.:
        // main: ['es5: dist.es5', 'es6: dist.es6'],
    },
    
    range: {
        // associates recipes to 'flavors'
        //   each key is the name of a 'flavor' to use in the `domain` hash
        //   each value is an array of recipes to associate with this flavor
        // e.g.:
        // es5: ['transpile', 'develop: transpile'],
        //   the `:` denotes a space-delimited list of recipes to pass as dependencies
        //   you can make empty recipes by using square brackets[] around the recipe name
        // e.g.:
        // bundle: [ '[all]: less jade browserify', 'less', ... ],
        //   which is useful for creating tasks that simply run their dependencies
    },
    
    options: {
        // passes options to recipes via their `this.options`
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

