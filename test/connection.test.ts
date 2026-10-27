// PLP-14: run the shipped connection helper as a process; the client owns OAuth and its credentials.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const helper = new URL('../scripts/connect-codex.mjs', import.meta.url);
function fixture(t: { after: (fn: () => void) => void }, server?: unknown, failure?: string, loginStatus = 0) {
  const dir = mkdtempSync(join(tmpdir(), 'plugin-codex-connect-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const client = join(dir, 'codex'), log = join(dir, 'calls.jsonl');
  writeFileSync(client, `#!${process.execPath}\nimport { appendFileSync } from 'node:fs';
const args=process.argv.slice(2); appendFileSync(${JSON.stringify(log)}, JSON.stringify(args)+'\\n');
if(args[0]==='mcp' && args[1]==='get') {
  ${server === undefined ? `console.error(${JSON.stringify(failure ?? 'No MCP server named agent-cloud found.')}); process.exit(1);` : `console.log(${JSON.stringify(JSON.stringify(server))}); process.exit(0);`}
}
process.exit(${loginStatus});\n`);
  chmodSync(client, 0o755);
  return {
    run: (...args: string[]) => spawnSync(process.execPath, [helper.pathname, '--codex', client, ...args], { encoding: 'utf8', timeout: 10000 }),
    calls: () => readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)),
  };
}
const configured = { enabled: true, transport: { type: 'streamable_http', url: 'https://agent.cloud/mcp' } };

test('PLP-14: check inspects the existing connection without starting OAuth or changing configuration', t => {
  const f = fixture(t, configured), result = f.run('--check');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { ready: true, server: 'agent-cloud', resource: 'https://agent.cloud/mcp', configured: true, action: 'oauth_login', configuration_changed: false });
  assert.deepEqual(f.calls(), [['mcp', 'get', 'agent-cloud', '--json']]);
});

test('PLP-14: absent plugin-only server uses explicit invocation-scoped login, including staging and manual browser', t => {
  const f = fixture(t), result = f.run('--staging', '--no-browser');
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(f.calls(), [
    ['mcp', 'get', 'agent-cloud-staging', '--json'],
    ['-c', 'mcp_servers.agent-cloud-staging.url="https://staging-agent.cloud/mcp"', 'mcp', 'login', 'agent-cloud-staging', '--no-browser'],
  ]);
  assert.match(result.stdout, /fresh Codex chat/); assert.match(result.stdout, /account_get/);
});

test('PLP-14: foreign URLs, disabled entries and custom authentication are never overwritten', t => {
  for (const server of [
    { ...configured, enabled: false },
    { transport: { ...configured.transport, url: 'https://another.example/mcp' } },
    ...['bearer_token_env_var', 'http_headers', 'env_http_headers', 'http_headers_helper'].map(key => ({ transport: { ...configured.transport, [key]: 'synthetic-custom-auth' } })),
  ]) {
    const f = fixture(t, server), result = f.run();
    assert.equal(result.status, 1); assert.match(result.stderr, /Nothing was changed/); assert.equal(f.calls().length, 1);
  }
});

test('PLP-14: inspection errors fail closed without exposing configuration output', t => {
  const f = fixture(t, undefined, 'Failed to read configuration: synthetic-sensitive-marker'), result = f.run();
  assert.equal(result.status, 1); assert.doesNotMatch(result.stderr + result.stdout, /synthetic-sensitive-marker/); assert.equal(f.calls().length, 1);
});

test('PLP-14: cancelled OAuth stays unconfirmed and provides a manual-browser recovery', t => {
  const f = fixture(t, configured, undefined, 1), result = f.run();
  assert.equal(result.status, 1); assert.match(result.stderr, /not confirmed/); assert.match(result.stderr, /--no-browser/);
  assert.doesNotMatch(result.stdout, /OAuth finished/);
});

test('PLP-14: invalid helper arguments are rejected before invoking a client', () => {
  for (const args of [['--unknown'], ['--codex'], ['--codex', '--check']]) {
    const result = spawnSync(process.execPath, [helper.pathname, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 2); assert.match(result.stderr, /Use connect-codex/);
  }
});
