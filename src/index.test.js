import fs from 'fs-extra';
import path from 'path';
import _ from 'lodash';
import delay from 'delay';
import iopipe from '@iopipe/core';
import mockContext from 'aws-lambda-mock-context';
import spawn from 'cross-spawn';

import pkg from '../package';
// import { invocations } from './addToReport';

const loggerPlugin = require('.');

beforeEach(() => {
  delete process.env.IOPIPE_LOGGER_ENABLED;
});

test('Can instantiate the plugin with no options', () => {
  const plugin = loggerPlugin();
  const inst = plugin({});
  expect(_.isFunction(inst.hooks['post:setup'])).toBe(true);
  expect(_.isFunction(inst.postSetup)).toBe(true);
  expect(_.isFunction(inst.hooks['pre:report'])).toBe(true);
  expect(_.isFunction(inst.preReport)).toBe(true);
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

  const outString = stdout.toString();
  const errString = stderr.toString();

  // we should still expect that typical console methods report to stdout or stderr
  // while simultaneously capturing them to send in the report
  expect(stdout.toString().split('\n')[0]).toEqual('log-string-test 72');

  const { val, logs } = fs.readJsonSync(resultPath);
  expect(val).toEqual('lambda-complete');

  // ensure the logs have a timestamp now so we don't have a continual conflicting snapshot
  expect(logs[0].timestamp).toBeGreaterThan(1530565119836);
  const logsWithoutTimestamp = logs.map(l => _.omit(l, ['timestamp']));
  expect(logsWithoutTimestamp).toMatchSnapshot();
});
