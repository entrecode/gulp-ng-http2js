'use strict';

var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = gutil.File;

var MODULE_TPL = "(function(module) {\n" +
  "angular.module(\'${moduleName}\', []).run([\'$cacheFactory\', function($cacheFactory) {\n" +
  "  var cache = $cacheFactory('${cacheId}');\n" +
  "<% requests.forEach(function(request) { %>  cache.put(\'${request.uri}\',\n    \'${request.contents}\');\n<% }); %>" +
  "}]);\n" +
  "})();\n";

// file can be a vinyl file object or a string
// when a string it will construct a new one
module.exports = function(opt) {
  opt = opt || {};

  var requests = [];

  function bufferContents(file, enc, cb) {
    // ignore empty files
    if (file.isNull()) {
      cb();
      return;
    }

    // we don't do streams (yet)
    if (file.isStream()) {
      this.emit('error', new PluginError('gulp-ng-http2js',  'Streaming not supported'));
      cb();
      return;
    }

    var uri = getFileUrl(file, opt);

    requests.push({
      uri: uri,
      contents: escapeContent(String(file.contents))
    });

    cb();
  }

  function endStream(cb) {
    if (!requests) {
      cb();
      return;
    }

    var file = new File({path: 'requests.js'});

    var value = gutil.template(MODULE_TPL, {
      moduleName: opt.moduleName,
      cacheId: opt.cacheId || '$http',
      requests: requests,
      file: file
    });

    file.contents = new Buffer(value);

    this.push(file);
    cb();
  }

  /**
   * Generates the url of a file.
   * @param file - The file for which a url should be generated
   * @param [options] - The plugin options
   * @param [options.stripPrefix] - The prefix which should be stripped from the file path
   * @param [options.prefix] - The prefix which should be added to the start of the url
   * @param [options.rename] - A function that takes in the generated url and returns the desired manipulation.
   * @returns {string}
   */
  function getFileUrl(file, options){
    // Start with the relative file path
    var url = file.path;

    // Replace '\' with '/' (Windows)
    url = url.replace(/\\/g, "/");

    // Remove the stripPrefix
    if(options && options.stripPrefix && url.indexOf(options.stripPrefix) === 0){
      url = url.replace(options.stripPrefix, "");
    }
    // Add the prefix
    if(options && options.prefix){
      url = options.prefix + url;
    }

    // Rename the url
    if(options && options.rename){
      url = options.rename(url);
    }

    return url;
  }

  /**
   * Escapes the content of an string so it can be used in a Javascript string declaration
   * @param {string} content
   * @returns {string}
   */
  function escapeContent(content){
    return content.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r?\n/g, "\\n");
  }

  return through.obj(bufferContents, endStream);
};
