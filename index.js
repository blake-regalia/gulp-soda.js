var a_version = process.versions.node.split(/\./g);
var n_major = ~~a_version[0];
var n_minor = ~~a_version[1];
var n_patch = ~~a_version[2];

// only for node >= v6.2.1 (prior releases of 6 cause debugging errors)
if(n_major > 6 || (n_major === 6 && (n_minor > 2 || (n_minor === 2 && n_patch >= 1)))) {
	module.exports = require('./dist.es6/soda.js');
}
// default to es5 version
else {
	module.exports = require('./dist.es5/soda.js');
}
