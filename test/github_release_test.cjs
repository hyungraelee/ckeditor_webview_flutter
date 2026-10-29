// SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { packageVersion, changelogEntry, metadata, mergedRelease, tagAndDispatch,
  validateTag, publishSources, sha256, checkReleaseTitle } = require('../tool/release/github_release.cjs');

const repository = 'hyungraelee/ckeditor_webview_flutter';
const sha = 'a'.repeat(40);
function event() {
  return { action: 'closed', pull_request: {
    merged: true, merged_at: '2026-10-14T00:00:00Z', title: 'Release v0.2.0', merge_commit_sha: sha,
    base: { ref: 'main', repo: { full_name: repository } },
    head: { ref: 'develop', repo: { full_name: repository } }
  } };
}

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ckeditor-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const version = '0.2.0';
  const tag = `v${version}`;
  const archive = `ckeditor_webview_flutter-${version}-sources.tar.gz`;
  const sourceUrl = `https://github.com/${repository}/releases/download/${tag}/${archive}`;
  fs.writeFileSync(path.join(root, 'pubspec.yaml'), `version: ${version}\n`);
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), '## 0.3.0\n\nFuture feature.\n\n' +
    `## ${version}\n\nFix HTML retrieval after recovery.\n\n## 0.1.0\n\nOld changes.\n`);
  for (const name of ['README.md', 'THIRD_PARTY_NOTICES.md']) {
    fs.writeFileSync(path.join(root, name), `[Source](${sourceUrl})\n[Checksum](${sourceUrl}.sha256)\n`);
  }
  const directory = path.join(root, '.dart_tool/release');
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, archive);
  fs.writeFileSync(file, 'verified source fixture');
  fs.writeFileSync(`${file}.sha256`, `${sha256(file)}  ${archive}\n`);
  return { root, meta: metadata(root, tag), file };
}

test('stable package versions parse, ambiguous and prerelease versions reject', () => {
  assert.equal(packageVersion("version: '0.2.0' # release\n"), '0.2.0');
  for (const value of ['01.2.0', '0.2.0-beta.1', '0.2.0+1', '0.2', '0.2.0\nversion: 0.3.0']) {
    assert.throws(() => packageVersion(`version: ${value}\n`));
  }
});

test('notes select only the requested version rather than future or past changes', t => {
  const { root, meta } = fixture(t);
  assert.equal(meta.notes, 'Fix HTML retrieval after recovery.');
  assert.throws(() => changelogEntry('## 0.2.0\n\n## 0.1.0\nOld.', '0.2.0'), /empty/);
  assert.throws(() => changelogEntry('## 0.2.0\nA\n## 0.2.0\nB', '0.2.0'));
  assert.throws(() => metadata(root, 'v0.3.0'), /Tag/);
  fs.writeFileSync(path.join(root, 'README.md'), 'Old source links.');
  assert.throws(() => metadata(root, 'v0.2.0'), /README/);
});

test('only the matching merged release PR identifies the tag commit', () => {
  assert.deepEqual(mergedRelease(event(), repository, '0.2.0', sha), { tag: 'v0.2.0', sha });
  for (const mutate of [
    e => { e.action = 'opened'; },
    e => { e.pull_request.merged = false; e.pull_request.merged_at = null; },
    e => { e.pull_request.base.ref = 'develop'; },
    e => { e.pull_request.head.ref = 'feature'; },
    e => { e.pull_request.head.repo.full_name = 'fork/package'; },
    e => { e.pull_request.title = 'Release v0.3.0'; },
    e => { e.pull_request.merge_commit_sha = 'b'.repeat(40); }
  ]) {
    const invalid = event(); mutate(invalid);
    assert.throws(() => mergedRelease(invalid, repository, '0.2.0', sha));
  }
});

test('release PR title mismatch is rejected before the PR needs to be merged', () => {
  checkReleaseTitle({ title: 'Release v0.2.0', merged: false }, '0.2.0');
  assert.throws(() => checkReleaseTitle({ title: 'Release v0.1.1', merged: false }, '0.2.0'), /differ/);
});

test('new tag dispatches using the tag ref, rather than the moving main branch', async () => {
  const calls = [];
  await tagAndDispatch({ tag: 'v0.2.0', sha }, repository, async (...args) => {
    calls.push(args); return null;
  });
  assert.deepEqual(calls.slice(1), [
    ['POST', `repos/${repository}/git/refs`, { ref: 'refs/tags/v0.2.0', sha }],
    ['POST', `repos/${repository}/actions/workflows/release.yml/dispatches`, { ref: 'v0.2.0' }]
  ]);
});

test('retry preserves a matching tag and dispatches again without moving it', async () => {
  const calls = [];
  await tagAndDispatch({ tag: 'v0.2.0', sha }, repository, async (...args) => {
    calls.push(args);
    return args[0] === 'GET' ? { object: { type: 'commit', sha } } : null;
  });
  assert.equal(calls.filter(([method]) => method === 'POST').length, 1);
  assert.match(calls[1][1], /dispatches$/);
});

test('conflicting existing tag never dispatches or overwrites the tag', async () => {
  const calls = [];
  await assert.rejects(tagAndDispatch({ tag: 'v0.2.0', sha }, repository, async (...args) => {
    calls.push(args); return { object: { type: 'commit', sha: 'b'.repeat(40) } };
  }), /different commit/);
  assert.equal(calls.length, 1);
});

test('an annotated tag is compared by its commit', async () => {
  const calls = [];
  await tagAndDispatch({ tag: 'v0.2.0', sha }, repository, async (...args) => {
    calls.push(args);
    if (args[0] === 'POST') return null;
    return { object: args[1].includes('/git/tags/') ?
      { type: 'commit', sha } : { type: 'tag', sha: 'c'.repeat(40) } };
  });
  assert.equal(calls.length, 3);
});

test('publishing accepts only a tag associated with the matching merged release PR', async () => {
  const meta = { tag: 'v0.2.0' };
  const api = async () => [event().pull_request];
  await validateTag(meta, repository, 'refs/tags/v0.2.0', sha, api);
  await assert.rejects(validateTag(meta, repository, 'refs/heads/main', sha, api), /tag ref/);
  await assert.rejects(validateTag(meta, repository, 'refs/tags/v0.2.0', 'b'.repeat(40), api), /matching/);
  await assert.rejects(validateTag(meta, repository, 'refs/tags/v0.2.0', sha, async () => []), /matching/);
});

test('sources become public only after upload, followed by anonymous byte checks', async t => {
  const { root, meta, file } = fixture(t);
  const calls = [];
  await publishSources(meta, root, repository, async (method, endpoint, body) => {
    calls.push([method, endpoint, body]);
    if (endpoint.includes('/releases?')) return [];
    return method === 'POST' ? { id: 7, draft: true, assets: [] } : null;
  }, files => { calls.push(['UPLOAD', ...files]); }, async (url, token) => {
    assert.equal(token, undefined);
    calls.push(['PUBLIC', url]);
    return sha256(url.endsWith('.sha256') ? `${file}.sha256` : file);
  });
  assert.deepEqual(calls.map(call => call[0]), ['GET', 'GET', 'POST', 'UPLOAD', 'PATCH', 'PUBLIC', 'PUBLIC']);
  assert.equal(calls[2][2].draft, true);
  assert.match(calls[2][2].body, /Fix HTML retrieval/);
  assert.doesNotMatch(calls[2][2].body, /Old changes|Future feature/);
});

test('retry discovers an interrupted draft and uploads only the missing sidecar', async t => {
  const { root, meta, file } = fixture(t);
  const calls = [];
  await publishSources(meta, root, repository, async (method, endpoint, body) => {
    calls.push([method, endpoint, body]);
    if (endpoint.includes('/releases?')) return [{ id: 7, tag_name: meta.tag, draft: true,
      assets: [{ name: meta.archive, url: 'https://api.github.com/archive' }] }];
    if (method === 'POST') assert.fail('Do not create a duplicate draft');
    return null;
  }, files => assert.deepEqual(files, [`${file}.sha256`]), async url =>
    sha256(url.endsWith('.sha256') ? `${file}.sha256` : file));
  assert.equal(calls.filter(([method]) => method === 'PATCH').length, 1);
});

test('retry reuses identical public assets without uploading or replacing them', async t => {
  const { root, meta, file } = fixture(t);
  const assets = [meta.archive, `${meta.archive}.sha256`].map(name => ({ name, url: `https://api.github.com/${name}` }));
  const calls = [];
  await publishSources(meta, root, repository, async (...args) => {
    calls.push(args); return { id: 7, draft: false, assets };
  }, () => assert.fail('Existing assets must not be uploaded again'), async url =>
    sha256(url.endsWith('.sha256') ? `${file}.sha256` : file));
  assert.equal(calls.length, 1);
});

test('different existing source bytes stop publication and preserve the release', async t => {
  const { root, meta } = fixture(t);
  const calls = [];
  await assert.rejects(publishSources(meta, root, repository, async (...args) => {
    calls.push(args); return { id: 7, draft: true, assets: [{ name: meta.archive, url: 'https://api.github.com/asset' }] };
  }, () => assert.fail('Do not upload over a conflict'), async () => 'wrong'), /asset differs/);
  assert.equal(calls.length, 1);
});

test('a corrupt local checksum stops before contacting GitHub', async t => {
  const { root, meta, file } = fixture(t);
  fs.writeFileSync(`${file}.sha256`, 'wrong');
  await assert.rejects(publishSources(meta, root, repository,
    () => assert.fail('Corrupt source must not contact GitHub')), /checksum/);
});
