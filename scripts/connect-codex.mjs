#!/usr/bin/env node
// PLP-14: the M0-qualified explicit login route. Uses only supported Codex commands,
// never agc or client credential stores. M2 bundles this in the installed Setup skill.
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const flags = process.argv.slice(2);
const allowed = new Set(['--staging', '--check', '--no-browser', '--help', '--codex']);
let binary;
for (let i = 0; i < flags.length; i++) {
  const flag = flags[i];
  if (!allowed.has(flag) || (flag === '--codex' && (!flags[i + 1] || flags[i + 1].startsWith('--')))) {
    console.error('Use connect-codex.mjs [--staging] [--check] [--no-browser] [--codex /path/to/codex].'); process.exit(2);
  }
  if (flag === '--codex') binary = flags[++i];
}
if (flags.includes('--help')) {
  console.log('Connect the installed agent.cloud plugin using Codex’s OAuth flow. --check inspects configuration without changing it or opening a browser. --codex selects your installed Codex CLI. --staging keeps a separate staging connection.'); process.exit(0);
}
const origin = flags.includes('--staging') ? 'https://staging-agent.cloud' : 'https://agent.cloud';
const name = flags.includes('--staging') ? 'agent-cloud-staging' : 'agent-cloud';
const resource = `${origin}/mcp`;
if (!binary) {
  const path = spawnSync('codex', ['--version'], { encoding: 'utf8', timeout: 10000 });
  if (!path.error && path.status === 0) binary = 'codex';
  else {
    const bundled = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
    if (process.platform === 'darwin' && existsSync(bundled)) binary = bundled;
  }
}
if (!binary) { console.error('Codex CLI was not found. Use --codex with the CLI from your Codex desktop installation, or install the Codex CLI, then retry. The agent.cloud CLI is not needed.'); process.exit(2); }
const inspected = spawnSync(binary, ['mcp', 'get', name, '--json'], { encoding: 'utf8', timeout: 10000, maxBuffer: 65536 });
let configured = false;
if (!inspected.error && inspected.status === 0) {
  let server;
  try { server = JSON.parse(inspected.stdout); } catch { console.error('Codex returned an unreadable server configuration. Inspect it with codex mcp get before connecting.'); process.exit(1); }
  if (server.transport?.type !== 'streamable_http' || server.transport.url !== resource || server.enabled === false || server.transport.bearer_token_env_var || server.transport.http_headers || server.transport.env_http_headers || server.transport.http_headers_helper) {
    console.error(`The existing ${name} configuration differs from this plugin’s OAuth connection. Nothing was changed. Inspect codex mcp get ${name}; resolve the conflicting URL, disabled server or custom authorization before retrying.`); process.exit(1);
  }
  configured = true;
} else if (inspected.error || !/No MCP server named|not found/i.test(inspected.stderr ?? '')) {
  console.error('Codex could not inspect the named MCP server. Check your Codex installation before retrying; no configuration was changed.'); process.exit(1);
}
if (flags.includes('--check')) {
  console.log(JSON.stringify({ ready: true, server: name, resource, configured, action: 'oauth_login', configuration_changed: false })); process.exit(0);
}
console.log(`Connecting ${name}. Complete sign-in, organization selection and consent in your browser. This does not grant access to your other chats.`);
const args = ['-c', `mcp_servers.${name}.url="${resource}"`, 'mcp', 'login', name, ...(flags.includes('--no-browser') ? ['--no-browser'] : [])];
// The client owns all credential handling. The helper never captures or persists login output or tokens.
const login = spawnSync(binary, args, { stdio: 'inherit' });
if (login.error || login.status !== 0) { console.error('Connection was not confirmed. Retry this command, or use --no-browser if automatic browser opening is unavailable.'); process.exit(1); }
console.log(`OAuth finished. Open a fresh Codex chat with the agent.cloud plugin and ask it to call account_get once. Verify the organization it returns before creating an app. Manage or revoke access at ${origin}/plugins/connect.`);
