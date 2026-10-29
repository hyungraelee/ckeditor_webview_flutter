// SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PACKAGE = 'ckeditor_webview_flutter';
const REPOSITORY = `hyungraelee/${PACKAGE}`;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function packageVersion(pubspec) {
  const matches = [...pubspec.matchAll(/^version:\s*([^\r\n]+)$/gm)];
  if (matches.length !== 1) throw new Error('Expected one package version.');
  const version = matches[0][1].split(/\s+#/)[0].trim().replace(/^(['"])(.*)\1$/, '$2');
  if (!VERSION.test(version)) throw new Error('Only stable X.Y.Z releases are supported.');
  return version;
}

function changelogEntry(changelog, version) {
  const heading = `## ${version}`;
  const lines = changelog.split(/\r?\n/);
  const starts = lines.flatMap((line, i) => line.trim() === heading ? [i + 1] : []);
  if (starts.length !== 1) throw new Error(`Expected one CHANGELOG entry for ${version}.`);
  let end = starts[0];
  while (end < lines.length && !/^##\s/.test(lines[end])) end++;
  const entry = lines.slice(starts[0], end).join('\n').trim();
  if (!entry) throw new Error('Release CHANGELOG entry is empty.');
  return entry;
}

function metadata(root, tag) {
  const version = packageVersion(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8'));
  if (tag !== `v${version}`) throw new Error('Tag does not match pubspec.yaml.');
  const archive = `${PACKAGE}-${version}-sources.tar.gz`;
  const sourceUrl = `https://github.com/${REPOSITORY}/releases/download/${tag}/${archive}`;
  for (const name of ['README.md', 'THIRD_PARTY_NOTICES.md']) {
    const text = fs.readFileSync(path.join(root, name), 'utf8');
    for (const url of [sourceUrl, `${sourceUrl}.sha256`]) {
      if (!text.includes(`](${url})`)) throw new Error(`${name} must link to this release's sources.`);
    }
  }
  return { version, tag, archive, sourceUrl,
    notes: changelogEntry(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'), version) };
}

function isReleasePr(pr, repository) {
  return Boolean((pr.merged === true || pr.merged_at) && pr.base?.ref === 'main' &&
    pr.head?.ref === 'develop' && pr.base?.repo?.full_name === repository &&
    pr.head?.repo?.full_name === repository);
}

function mergedRelease(event, repository, version, head) {
  const pr = event.pull_request;
  if (event.action !== 'closed' || !isReleasePr(pr, repository)) {
    throw new Error('Expected a merged, same-repository develop -> main PR.');
  }
  checkReleaseTitle(pr, version);
  if (!/^[a-f0-9]{40}$/.test(pr.merge_commit_sha) || pr.merge_commit_sha !== head) {
    throw new Error('Checkout must be the release PR merge commit.');
  }
  return { tag: `v${version}`, sha: head };
}

function checkReleaseTitle(pr, version) {
  if (pr.title !== `Release v${version}`) throw new Error('Release PR title and version differ.');
}

async function github(method, endpoint, body) {
  const response = await fetch(`https://api.github.com/${endpoint}`, {
    method, headers: { Authorization: `Bearer ${process.env.GH_TOKEN}`,
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 404 && method === 'GET') return null;
  if (!response.ok) throw new Error(`GitHub ${method} ${endpoint}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function tagAndDispatch(release, repository, api = github) {
  const prefix = `repos/${repository}`;
  const existing = await api('GET', `${prefix}/git/ref/tags/${release.tag}`);
  if (existing) {
    let object = existing.object;
    // Dereference an existing annotated tag without moving it.
    for (let depth = 0; object.type === 'tag' && depth < 5; depth++) {
      object = (await api('GET', `${prefix}/git/tags/${object.sha}`)).object;
    }
    if (object.type !== 'commit' || object.sha !== release.sha) {
      throw new Error('Existing release tag points to a different commit.');
    }
  } else {
    await api('POST', `${prefix}/git/refs`, { ref: `refs/tags/${release.tag}`, sha: release.sha });
  }
  // GITHUB_TOKEN tag pushes do not start another push workflow.
  await api('POST', `${prefix}/actions/workflows/release.yml/dispatches`, { ref: release.tag });
}

async function validateTag(meta, repository, ref, head, api = github) {
  if (repository !== REPOSITORY || ref !== `refs/tags/${meta.tag}`) {
    throw new Error('Publishing requires this repository and a version tag ref.');
  }
  const prefix = `repos/${repository}`;
  const pulls = [];
  for (let page = 1; ; page++) {
    const batch = await api('GET', `${prefix}/commits/${head}/pulls?per_page=100&page=${page}`);
    if (!Array.isArray(batch)) throw new Error('Cannot verify the release PR.');
    pulls.push(...batch);
    if (batch.length < 100) break;
  }
  if (!pulls.some(pr => isReleasePr(pr, repository) &&
    pr.title === `Release ${meta.tag}` && pr.merge_commit_sha === head)) {
    throw new Error('Tag must point to the matching merged release PR commit.');
  }
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function downloadHash(url, token) {
  const response = await fetch(url, { headers: token ? {
    Authorization: `Bearer ${token}`, Accept: 'application/octet-stream'
  } : {} });
  if (!response.ok) throw new Error(`Source download failed: HTTP ${response.status}`);
  return crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex');
}

async function findRelease(prefix, tag, api) {
  const published = await api('GET', `${prefix}/releases/tags/${tag}`);
  if (published) return published;
  // The tag endpoint documents published releases; include an interrupted draft.
  for (let page = 1; ; page++) {
    const releases = await api('GET', `${prefix}/releases?per_page=100&page=${page}`);
    if (!Array.isArray(releases)) throw new Error('Cannot inspect existing draft releases.');
    const found = releases.find(release => release.tag_name === tag);
    if (found) return found;
    if (releases.length < 100) return null;
  }
}

async function publishSources(meta, root, repository, api = github,
  upload = files => execFileSync('gh', ['release', 'upload', meta.tag, ...files,
    '--repo', repository], { stdio: 'inherit' }), hashDownload = downloadHash) {
  const directory = path.join(root, '.dart_tool/release');
  const archive = path.join(directory, meta.archive);
  const checksum = `${archive}.sha256`;
  const digest = sha256(archive);
  if (fs.readFileSync(checksum, 'utf8').trim() !== `${digest}  ${meta.archive}`) {
    throw new Error('Source archive checksum sidecar differs.');
  }
  const files = [archive, checksum];
  const prefix = `repos/${repository}`;
  let release = await findRelease(prefix, meta.tag, api);
  if (!release) {
    release = await api('POST', `${prefix}/releases`, {
      tag_name: meta.tag, name: meta.tag, draft: true,
      body: `${meta.notes}\n\n## Source distribution\n\n` +
        `GPL-2.0-or-later.\n\n[Source archive](${meta.sourceUrl})\n\n` +
        `[SHA-256 checksum](${meta.sourceUrl}.sha256)\n\nSHA-256: \`${digest}\`.\n`
    });
  }
  const missing = [];
  for (const file of files) {
    const asset = release.assets.find(item => item.name === path.basename(file));
    if (!asset) { missing.push(file); continue; }
    const remoteHash = await hashDownload(asset.url, process.env.GH_TOKEN);
    if (remoteHash !== sha256(file)) throw new Error(`Existing release asset differs: ${asset.name}`);
  }
  if (missing.length) upload(missing); // No --clobber; preserve already uploaded bytes.
  if (release.draft) await api('PATCH', `${prefix}/releases/${release.id}`, { draft: false });
  // Public availability is required before publishing the Flutter package.
  for (const file of files) {
    const url = `https://github.com/${repository}/releases/download/${meta.tag}/${path.basename(file)}`;
    if (await hashDownload(url) !== sha256(file)) throw new Error('Anonymous source checksum differs.');
  }
}

async function main() {
  const command = process.argv[2];
  const root = process.cwd();
  const repository = process.env.GITHUB_REPOSITORY;
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const version = packageVersion(fs.readFileSync('pubspec.yaml', 'utf8'));
  const meta = metadata(root, `v${version}`);
  if (command === 'metadata') {
    if (process.env.GITHUB_EVENT_NAME === 'pull_request') {
      const { pull_request: pr } = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
      if (pr.base.ref === 'main' && pr.head.ref === 'develop') checkReleaseTitle(pr, version);
    }
    return console.log(JSON.stringify(meta, null, 2));
  }
  if (repository !== REPOSITORY) throw new Error('Unexpected publishing repository.');
  if (command === 'tag-pr') {
    const event = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const release = mergedRelease(event, repository, version, head);
    return tagAndDispatch(release, repository);
  }
  await validateTag(meta, repository, process.env.GITHUB_REF, head);
  const tagHead = execFileSync('git', ['rev-parse', `${meta.tag}^{commit}`], { encoding: 'utf8' }).trim();
  if (tagHead !== head) throw new Error('Local tag and checkout differ.');
  if (execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()) {
    throw new Error('Release checkout must be clean.');
  }
  if (command === 'validate-tag') {
    fs.mkdirSync('.dart_tool/release', { recursive: true });
    fs.writeFileSync('.dart_tool/release/metadata.json', JSON.stringify({ ...meta, commit: head }, null, 2) + '\n');
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `version=${meta.version}\ntag=${meta.tag}\narchive=${meta.archive}\ncommit=${head}\n`);
  } else if (command === 'publish-sources') {
    await publishSources(meta, root, repository);
  } else {
    throw new Error(`Unknown release command: ${command}`);
  }
}

module.exports = { packageVersion, changelogEntry, metadata, mergedRelease, checkReleaseTitle,
  tagAndDispatch, validateTag, publishSources, sha256 };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
