import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { buildPackage } from '../scripts/build.mjs';

function fixture(t: test.TestContext, environment: string) {
  const dir = mkdtempSync(join(tmpdir(), 'agent-cloud-plugin-setup-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const project = join(dir, 'existing-app'), clientHome = join(dir, 'client');
  mkdirSync(project); mkdirSync(clientHome);
  const owned = {
    'AGENTS.md': 'Keep our existing app instructions.',
    'CLAUDE.md': '@AGENTS.md\nOur extra rules.',
    'agentcloud.toml': 'name = "already-selected"\n',
  };
  for (const [name, body] of Object.entries(owned)) writeFileSync(join(project, name), body);
  writeFileSync(join(clientHome, 'AGENTS.md'), 'Existing global Codex instructions.');
  const result = spawnSync(process.execPath, [new URL('../scripts/build.mjs', import.meta.url).pathname, ...(environment === 'staging' ? ['--staging'] : []), '--out', join(dir, 'bundle')], {
    cwd: project, encoding: 'utf8', env: { ...process.env, CODEX_HOME: clientHome, CLAUDE_CONFIG_DIR: clientHome },
  });
  assert.equal(result.status, 0, result.stderr);
  const built = JSON.parse(result.stdout);
  return { dir, project, clientHome, owned, built };
}

test('PLG-1, PLG-13, PLG-29, PBP-1: packaging Setup preserves app files, global instructions and client configuration', t => {
  const f = fixture(t, 'staging');
  assert.deepEqual(readdirSync(f.project).sort(), Object.keys(f.owned).sort());
  for (const [name, body] of Object.entries(f.owned)) assert.equal(readFileSync(join(f.project, name), 'utf8'), body);
  assert.deepEqual(readdirSync(f.clientHome), ['AGENTS.md']);
  assert.equal(readFileSync(join(f.clientHome, 'AGENTS.md'), 'utf8'), 'Existing global Codex instructions.');
  assert.equal(f.built.environment, 'staging');
});

test('PLG-4, PLG-12, PLG-29, PLP-14: the installed Setup helper checks the same environment without OAuth, app creation or configuration changes', t => {
  for (const environment of ['production', 'staging']) {
    const f = fixture(t, environment), log = join(f.dir, 'calls.jsonl'), client = join(f.dir, 'codex');
    const origin = environment === 'staging' ? 'https://staging-agent.cloud' : 'https://agent.cloud';
    const name = environment === 'staging' ? 'agent-cloud-staging' : 'agent-cloud';
    writeFileSync(client, `#!${process.execPath}\nimport { appendFileSync } from 'node:fs';\nconst args=process.argv.slice(2);\nappendFileSync(${JSON.stringify(log)}, JSON.stringify(args)+'\\n');\nif (args.join(' ') !== ${JSON.stringify(`mcp get ${name} --json`)}) process.exit(42);\nconsole.log(JSON.stringify({ enabled:true, transport:{type:'streamable_http',url:${JSON.stringify(`${origin}/mcp`)}} }));\n`);
    chmodSync(client, 0o755);
    const helper = join(f.built.plugin, 'scripts/connect-codex.mjs');
    const result = spawnSync(process.execPath, [helper, '--codex', client, '--check', ...(environment === 'staging' ? ['--staging'] : [])], { cwd: f.project, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ready: true, server: name, resource: `${origin}/mcp`, configured: true, action: 'oauth_login', configuration_changed: false });
    assert.deepEqual(readFileSync(log, 'utf8').trim().split('\n').map(line => JSON.parse(line)), [['mcp', 'get', name, '--json']]);
    for (const [file, body] of Object.entries(f.owned)) assert.equal(readFileSync(join(f.project, file), 'utf8'), body);
  }
});

test('PLG-29: installed helper bytes and version are covered by the artifact manifest', t => {
  const dir = mkdtempSync(join(tmpdir(), 'agent-cloud-plugin-version-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const built = buildPackage({ out: join(dir, 'bundle') });
  const metadata = JSON.parse(readFileSync(join(built.plugin, 'bundle.json'), 'utf8'));
  assert.equal(metadata.version, built.version);
  assert.deepEqual(readFileSync(join(built.plugin, 'scripts/connect-codex.mjs')), readFileSync(new URL('../scripts/connect-codex.mjs', import.meta.url)));
  assert.equal(metadata.files['scripts/connect-codex.mjs'].sha256.length, 64);
});
