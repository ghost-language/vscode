#!/usr/bin/env node
// @ts-check
'use strict';

/**
 * Lifts one version's section out of CHANGELOG.md, so a GitHub release carries
 * the notes that were already written rather than a second, drifting copy.
 *
 * Usage: node scripts/release-notes.js 0.1.0
 *
 * Exits non-zero when the version has no section, which is deliberate: a
 * release cut without notes is a mistake worth stopping for, not a blank body
 * worth publishing.
 */

const fs = require('fs');
const path = require('path');

/**
 * @param {string} changelog  the whole file
 * @param {string} version    without a leading `v`
 * @returns {string | undefined}
 */
function extract(changelog, version) {
	const lines = changelog.split('\n');
	// `## [0.1.0] - 2026-08-22`, and the bare `## [0.1.0]` an unreleased-then-
	// tagged section can be left as.
	const heading = new RegExp('^##\\s+\\[' + version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]');
	const anyHeading = /^##\s+/;

	const start = lines.findIndex((line) => heading.test(line));

	if (start === -1) {
		return undefined;
	}

	let end = lines.length;

	for (let index = start + 1; index < lines.length; index++) {
		if (anyHeading.test(lines[index])) {
			end = index;
			break;
		}
	}

	const body = lines.slice(start + 1, end).join('\n').trim();

	return body || undefined;
}

module.exports = { extract };

if (require.main === module) {
	const version = (process.argv[2] || '').replace(/^v/, '');

	if (!version) {
		console.error('usage: node scripts/release-notes.js <version>');
		process.exit(2);
	}

	const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
	const notes = extract(fs.readFileSync(changelogPath, 'utf8'), version);

	if (!notes) {
		console.error(
			'No CHANGELOG.md section for ' + version + '. Add a "## [' + version + '] - YYYY-MM-DD" ' +
			'heading with the release notes under it.'
		);
		process.exit(1);
	}

	process.stdout.write(notes + '\n');
}
