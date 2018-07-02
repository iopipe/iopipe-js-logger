const fs = require('fs');
const path = require('path');
const { Console } = require('console');
const { Readable, Writable } = require('stream');
const pkg = require('../package');

function getConfig(config = {}) {
  const key = process.env.IOPIPE_LOGGER_ENABLED || '';
  const keyFalsey =
    ['false', 'f', '0'].indexOf(key.toString().toLowerCase()) > -1;
  let enabled = config.enabled || key;
  if (keyFalsey) {
    enabled = false;
  }
  return {
    enabled: Boolean(enabled)
  };
}

const methods = ['log', 'debug', 'info', 'warn', 'error', 'dir'];

class LoggerPlugin {
  constructor(config = {}, invocationInstance) {
    this.invocationInstance = invocationInstance;
    this.logs = [];
    this.config = getConfig(config);
    this.consoleMethods = {};
    this.hooks = {
      'post:setup': this.postSetup.bind(this),
      'pre:report': this.preReport.bind(this)
    };
    return this;
  }

  get meta() {
    return { name: pkg.name, version: pkg.version, homepage: pkg.homepage };
  }

  postSetup() {
    if (this.config.enabled) {
      this.runConsoleShim();
    }
  }

  runConsoleShim() {
    // assign a new Console for each method we want to support
    // with it's own data
    // so we can label the data by console method later
    methods.forEach(method => {
      this.consoleMethods[method] = {
        chunks: [],
        lines: [],
        stdout: new Writable(),
        stderr: new Writable(),
        console: undefined
      };
      // each Console class expects a stdout and stderr writable stream
      ['stdout', 'stderr'].forEach(output => {
        this.consoleMethods[method][output]._write = (
          chunk,
          encoding,
          next
        ) => {
          // when the console method is invoked, we get a chunk from the stream
          this.consoleMethods[method].lines.push({
            message: (chunk || '').toString(),
            severity: method,
            timestamp: Date.now()
          });
          next();
        };
      });
      this.consoleMethods[method].console = new Console(
        this.consoleMethods[method].stdout,
        this.consoleMethods[method].stderr
      );
    });

    // rename the original console methods
    // to replace with our own shimmed version
    methods.forEach(method => {
      const descriptor = Object.getOwnPropertyDescriptor(console, method);
      if (descriptor) {
        Object.defineProperty(console, `original_${method}`, descriptor);
      }
      console[method] = (...args) => {
        // call our shimmed method
        this.consoleMethods[method].console[method](...args);
        // call the traditional method as well
        console[`original_${method}`](...args);
      };
    });
  }

  preReport() {
    methods.forEach(method => {
      const descriptor = Object.getOwnPropertyDescriptor(
        console,
        `original_${method}`
      );
      if (descriptor) {
        Object.defineProperty(console, method, descriptor);
      }
      this.logs = this.logs.concat(this.consoleMethods[method].lines);
    });
    fs.writeFileSync(
      path.join(__dirname, 'output.json'),
      JSON.stringify(this.logs),
      'utf-8'
    );
    // addToReport(this);
  }
}

module.exports = function instantiateLoggerPlugin(pluginOpts) {
  return invocationInstance => {
    return new LoggerPlugin(pluginOpts, invocationInstance);
  };
};
