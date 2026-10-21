# Scoped Lodash ES source regeneration

This maintainer recipe regenerates every Lodash ES module used by the bundled
editor. It does not run in consuming Flutter applications or change the editor
JS/CSS. It is a verified source-to-input path, not a claim that the complete
historical npm release process has been reproduced.

## Pinned inputs

- Preferred modification source: Lodash 4.17.21 development tag,
  commit `f299b52f39486275a9e6483b60a410e06520c538`, `lodash.js`.
- Generator: [bnjmnt4n/lodash-cli 4.17.21 commit](https://github.com/bnjmnt4n/lodash-cli/tree/37d28f589749c53ac838f1e53126c9f13d815acd).
  Its complete source, templates, scripts, and original MIT notice are retained;
  unused tests are omitted with notices preserved.
- Generator helpers: `glob` 7.1.1, `semver` 5.3.0, and `lodash` 4.17.21,
  plus locked transitive dependencies in [lodash-build/](lodash-build/).
- Expected ES modules: exact publication commit
  `11eb817cdfacf56c02d7005cbe520ffbeb0fe59a` and locked npm `lodash-es` 4.17.21.

Archive URLs, original hashes, selections, and npm integrity values are included
in the source manifest. The prior npm `lodash-cli` 4.17.5 reference is superseded
and no longer included in new candidates.

The generator repository's manifest pins Lodash 4.17.20 despite its own 4.17.21
version. This scoped recipe explicitly supplies 4.17.21 and verifies that its
installed `lodash.js` equals the development source before writing that source
into the disposable installation. No generator code is patched. The generator
uses the isolated helper installation through `NODE_PATH`; its original package
manifest remains unchanged. Closure Compiler, Java, and UglifyJS are not needed
for this modularized ES generation path and are not installed by this recipe.

The generator runs the [documented modularized ES command](https://lodash.com/custom-builds):

```sh
node <generator>/bin/lodash modularize exports=es -o <new-output-directory>
```

The isolated helper lock is a reconstruction recipe, not the original upstream
lockfile or proof of which environment produced the historical npm release.

## Reproduction and comparison

Use the standard [source preparation and offline rebuild commands](SOURCE_ARCHIVE.md).
Preparation preserves the generator and exact helper tarballs. Rebuilding
installs from those tarballs with lifecycle hooks disabled and a fresh npm cache,
then invokes the generator before rebuilding the editor.

The observed output contains 640 JavaScript modules. All 191 modules in
`bundled-module-identifiers.json` match both preserved publication sources and
the locked npm inputs byte for byte. The rebuild installs these regenerated
modules into the disposable editor build and rejects any audited difference
or unexpected coverage count.

For transparency, `LODASH_GENERATION_REPORT.json` also compares the entire
preserved publication's 644 JavaScript modules. Of those, 638 match; six are
absent or differ:

- `_addMapEntry.js`, `_addSetEntry.js`, `_cloneMap.js`, `_cloneSet.js`
- `lodash.default.js`, `lodash.js`

None of these six modules appears in the audited emitted editor inventory.
They remain preserved in the original publication sources; their absence or
difference is not silently normalized. This recipe establishes generation of
the distributed bundle's inputs and does not establish complete reproduction
of all published Lodash files. Repeat the inventory and source comparison if
the editor build begins using other Lodash modules.

Generate and verify the final archive from the clean release checkout. Follow
[SOURCE_ARCHIVE.md](SOURCE_ARCHIVE.md) for source preparation and
[AUTOMATED_RELEASE.md](AUTOMATED_RELEASE.md) for publication.
