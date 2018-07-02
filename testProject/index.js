const fs = require('fs');
const path = require('path');
const core = require('@iopipe/core');
const mockContext = require('aws-lambda-mock-context');

const plugin = require('../src');

const run = (event, context) => {
  const testArg2 = { showHidden: true };
  ['log', 'debug', 'info', 'warn', 'error', 'dir'].forEach(method => {
    console[method](`${method}-string-test`, 72);
    console[method](process.hrtime, { showHidden: true });
  });
  context.succeed('lambda-complete');
};

let inspectableInv = {};

const handler = core({
  token: 't',
  plugins: [plugin({ enabled: true }), inv => (inspectableInv = inv)]
})(run);

(async () => {
  const ctx = mockContext();
  handler({}, ctx);
  const val = await ctx.Promise;
  const usedPlugin = inspectableInv.plugins[0] || {};
  const { logs, consoleMethods } = usedPlugin;
  const tests = [logs.length === 6];

  fs.writeFileSync(
    path.join(__dirname, 'result.json'),
    JSON.stringify(
      {
        val,
        logs
      },
      null,
      ' '
    ),
    'utf-8'
  );

  return val;
})();
