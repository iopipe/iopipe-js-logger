import path from 'path';
import fs from 'fs-extra';
import _ from 'lodash';
import spawn from 'cross-spawn';

const loggerPlugin = require('.');

beforeEach(() => {
  delete process.env.IOPIPE_LOGGER_ENABLED;
});

test('Can instantiate the plugin with no options', () => {
  const plugin = loggerPlugin();
  const inst = plugin({});
  expect(_.isFunction(inst.hooks['post:setup'])).toBe(true);
  expect(_.isFunction(inst.postSetup)).toBe(true);
  expect(_.isFunction(inst.hooks['post:invoke'])).toBe(true);
  expect(_.isFunction(inst.postInvoke)).toBe(true);
  expect(_.isPlainObject(inst.config)).toBe(true);
  expect(Array.isArray(inst.logs)).toBe(true);
  expect(inst.config.enabled).toBe(false);
});

test('Can enable via object', () => {
  const plugin = loggerPlugin({ enabled: true });
  const inst = plugin();
  expect(inst.config.enabled).toBe(true);
});

test('Can enable via env var', () => {
  process.env.IOPIPE_LOGGER_ENABLED = 'true';
  const plugin = loggerPlugin();
  const inst = plugin();
  expect(inst.config.enabled).toBe(true);
});

test('Can disable via env var', () => {
  process.env.IOPIPE_LOGGER_ENABLED = 'false';
  const plugin = loggerPlugin();
  const inst = plugin();
  expect(inst.config.enabled).toBe(false);
});

test('Works in testProject', () => {
  const resultPath = path.join(__dirname, '../testProject/result.json');
  fs.removeSync(resultPath);
  const result = spawn.sync('node', ['testProject/index.js']);
  const [, stdout, stderr] = result.output;

  // we should still expect that typical console methods report to stdout and stderr while simultaneously capturing them to send in the report
  expect(stdout.toString().split('\n')[0]).toEqual('log-string-test 72');
  expect(stderr.toString()).toMatchSnapshot();

  const { val, logs, putData } = fs.readJsonSync(resultPath);
  expect(val).toEqual('lambda-complete');

  // expect that the intercepted file to S3 has good data in it
  expect(putData[0].startsWith('{"message":"log-string-test 72')).toBeTruthy();

  // ensure the logs have a timestamp now before we strip them out so we don't have a continual conflicting snapshot
  expect(logs[0].timestamp).toBeGreaterThan(1530565119836);
  const logsWithoutTimestamp = logs.map(l => _.omit(l, ['timestamp']));
  expect(logsWithoutTimestamp).toMatchSnapshot();
});
