const util = require('util');
const { Console } = require('console');
const { Writable } = require('stream');
const { util: coreUtil } = require('@iopipe/core');
const { concat } = require('simple-get');

const debuglog = util.debuglog('iopipe:logger');

const pkg = require('../package');

function stringNow(date = new Date()) {
  // format date as string in Athena / Hive format
  // ie "2018-07-03 15:23:51.000"
  const str = date.toISOString();
  return `${str.substring(0, 10)} ${str.substring(11, 23)}`;
}

const request = (...args) => {
  return new Promise((resolve, reject) => {
    concat(...args, (err, res) => (err ? reject(err) : resolve(res)));
  });
};

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
    this.uploads = [];
    this.config = getConfig(config);
    this.consoleMethods = {};
    this.hooks = {
      'post:setup': this.postSetup.bind(this),
      'post:invoke': this.postInvoke.bind(this)
    };
    return this;
  }

  get meta() {
    return {
      name: pkg.name,
      version: pkg.version,
      homepage: pkg.homepage,
      uploads: this.uploads,
      enabled: this.config.enabled
    };
  }

  postSetup() {
    if (this.config.enabled) {
      this.fileUploadMetaPromise = this.getFileUploadMeta();
      this.runConsoleShim();
    }
  }

  getFileUploadMeta() {
    const { startTimestamp } = this.invocationInstance;
    // returns a promise here
    return coreUtil.getFileUploadMeta({
      timestamp: startTimestamp,
      auth: this.invocationInstance.config.clientId,
      extension: '.log',
      requestId:
        this.invocationInstance.context &&
        this.invocationInstance.context.awsRequestId
    });
  }

  runConsoleShim() {
    // assign a new Console for each method we want to support
    // with its own data
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
            timestamp: stringNow()
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

  async postInvoke() {
    if (!this.config.enabled) {
      return false;
    }
    try {
      // reset console methods back to original
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
      // if no logs, do not send s3 upload request
      if (!this.logs.length) {
        return true;
      }
      const requestData = await this.fileUploadMetaPromise;
      const { jwtAccess, signedRequest, url } = requestData;
      debuglog(`Signer response: ${JSON.stringify(requestData)}`);
      if (signedRequest) {
        debuglog(`Signed request received for ${url}`);
        await request({
          url: signedRequest,
          method: 'PUT',
          body: this.logs.map(l => JSON.stringify(l)).join('\n')
        });
        if (
          typeof this.invocationInstance.context.iopipe.label === 'function'
        ) {
          this.invocationInstance.context.iopipe.label('@iopipe/plugin-logger');
        }
        this.uploads.push(jwtAccess);
      } else {
        debuglog(`Bad signer response: ${JSON.stringify(requestData)}`);
      }
    } catch (err) {
      debuglog(err);
    }
    return true;
  }
}

module.exports = function instantiateLoggerPlugin(pluginOpts) {
  return invocationInstance => {
    return new LoggerPlugin(pluginOpts, invocationInstance);
  };
};
