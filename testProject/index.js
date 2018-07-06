const fs = require('fs');
const path = require('path');
const core = require('@iopipe/core');
const mockContext = require('aws-lambda-mock-context');
const nock = require('nock');

const plugin = require('../src');

const putData = [];

// intercept http calls
nock(/signer/)
  .post('/')
  .reply(200, { jwtAccess: '1234', signedRequest: 'https://aws.com' });

nock(/aws\.com/)
  .put('/', body => {
    putData.push(body);
    return body;
  })
  .reply(200);

const run = (event, context) => {
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
  try {
    const ctx = mockContext();
    handler({}, ctx);
    const val = await ctx.Promise;
    const usedPlugin = inspectableInv.plugins[0] || {};
    const { logs } = usedPlugin;

    fs.writeFileSync(
      path.join(__dirname, 'result.json'),
      JSON.stringify(
        {
          val,
          logs,
          putData
        },
        null,
        ' '
      ),
      'utf-8'
    );

    return val;
  } catch (err) {
    console.error(err);
  }
  return false;
})();
