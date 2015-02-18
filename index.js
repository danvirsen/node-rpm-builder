'use strict';

var chalk = require('chalk');
var exec = require('child_process').exec;
var fsx = require('fs-extra')
var path = require('path');
var shortid = require('shortid');
var writeSpec = require('./lib/spec');
var _ = require('lodash');

module.exports = build;

function build(options, cb) {
  if (!options) {
    var err = new Error('Options must be defined');
    return cb(err);
  }

  var defaults = {
    name: 'no-name',
    summary: 'No summary',
    description: 'No description',
    version: '0.0.0',
    release: '1',
    license: 'MIT',
    vendor: 'Vendor',
    group: 'Development/Tools',
    buildArch: 'noarch',
    tempDir: 'tmp-' + shortid.generate(),
    files: [],
    keepTemp: false
  };

  options = _.defaults(options, defaults);

  var tmpDir = path.resolve(options.tempDir);
  var buildRoot = path.join(tmpDir, '/BUILDROOT/');
  var rpmStructure = ['BUILD', 'BUILDROOT', 'RPMS', 'SOURCES', 'SPECS', 'SRPMS'];

  // If the tmpDir exists (probably from previous build), delete it first
  if (fsx.existsSync(tmpDir)) {
    console.log(chalk.cyan('Removing old temporary directory.'));
    fsx.removeSync(tmpDir);
  }

  // Create RPM folder structure
  console.log(chalk.cyan('Creating RPM directory structure at:'), tmpDir);
  _.forEach(rpmStructure, function(dirName) {
    fsx.mkdirpSync(path.join(tmpDir, dirName));
  });

  // Copy source files to the BUILDROOT folder
  var files = [];
  _.forEach(options.files, function(file) {
    if (!file.hasOwnProperty('src') || !file.hasOwnProperty('dest')) {
      var err = new Error('All files must have source (src) and destination (dest) set');
      return cb(err);
    }

    files.push(file.dest);
    fsx.copySync(file.src, path.join(buildRoot, file.dest));
  });

  // Write spec file
  var specFile = writeSpec(files, options);
  console.log(chalk.cyan('SPEC file created:'), specFile);

  // Build the RPM package.
  var cmd = [
    'rpmbuild',
    '-bb',
    '-vv',
    '--buildroot',
    buildRoot,
    specFile
  ].join(' ');

  console.log(chalk.cyan('Executing:'), cmd);

  exec(cmd, {}, function rpm(err, stdout, stderr) {

    // Remove temp folder
    if (!options.keepTemp) {
      console.log(chalk.cyan('Removing RPM directory structure at:'), tmpDir);
      fsx.removeSync(tmpDir);
    }

    if (err) {
      return cb(err);
    }

    if (stdout) {
      var rpm = stdout.match(/(\/.+\..+\.rpm)/);
      if (rpm && rpm.length > 0) {
        var rpmDest = path.join(process.cwd(), path.basename(rpm[0]));
        console.log(chalk.cyan('Copying RPM package to:'), rpmDest);
        fsx.copySync(rpm[0], rpmDest);

        return cb(null, rpmDest);
      }
    }

  });
}