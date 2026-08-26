#!/usr/bin/env node
/**
 * dev → main release PR 본문 생성
 * main..dev 범위에 실제 포함된 PR/커밋만 나열한다.
 * Usage: node scripts/generate-release-pr-body.mjs [--output .github/release-pr-body.generated.md]
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const templatePath = join(
  root,
  '.github/PULL_REQUEST_TEMPLATE/release-dev-to-main.md'
);

function sh(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function shSafe(cmd, fallback = '') {
  try {
    return sh(cmd);
  } catch {
    return fallback;
  }
}

function fetchRemoteBranches() {
  shSafe(
    'git fetch origin refs/heads/main:refs/remotes/origin/main refs/heads/dev:refs/remotes/origin/dev --quiet'
  );
}

function getMainDevRange() {
  fetchRemoteBranches();
  const mainRef = shSafe('git rev-parse origin/main', 'origin/main');
  const devRef = shSafe('git rev-parse origin/dev', 'origin/dev');
  return { mainRef, devRef };
}

function getCommitLog(mainRef, devRef) {
  const log = shSafe(`git log ${mainRef}..${devRef} --oneline --no-decorate`);
  return log || '(main과 dev 사이 커밋 없음)';
}

function getCommitShasInRange(mainRef, devRef) {
  const out = shSafe(`git log ${mainRef}..${devRef} --format=%H`);
  return new Set(out.split('\n').filter(Boolean));
}

function getPrNumbersFromCommitMessages(mainRef, devRef) {
  const subjects = shSafe(`git log ${mainRef}..${devRef} --format=%s`);
  const numbers = new Set();

  for (const line of subjects.split('\n')) {
    if (!line) continue;
    for (const match of line.matchAll(/\(#(\d+)\)/g)) {
      numbers.add(Number(match[1]));
    }
  }

  return [...numbers];
}

function fetchPrBrief(number) {
  const json = shSafe(
    `gh pr view ${number} --json number,title,url,mergeCommit`,
    ''
  );
  if (!json) return null;

  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getMergedPrsInRange(mainRef, devRef) {
  const rangeShas = getCommitShasInRange(mainRef, devRef);

  if (rangeShas.size === 0) {
    return '(main과 dev 사이 변경 없음)';
  }

  const byNumber = new Map();

  for (const number of getPrNumbersFromCommitMessages(mainRef, devRef)) {
    const pr = fetchPrBrief(number);
    if (pr?.number) {
      byNumber.set(pr.number, pr);
    }
  }

  const json = shSafe(
    'gh pr list --base dev --state merged --limit 100 --json number,title,url,mergeCommit',
    '[]'
  );

  let prs = [];
  try {
    prs = JSON.parse(json);
  } catch {
    prs = [];
  }

  if (Array.isArray(prs)) {
    for (const pr of prs) {
      const mergeOid = pr.mergeCommit?.oid;
      if (mergeOid && rangeShas.has(mergeOid)) {
        byNumber.set(pr.number, pr);
      }
    }
  }

  if (byNumber.size === 0) {
    return '(이번 main..dev 범위에 연결된 merged PR 없음 — 커밋 요약만 참고)';
  }

  return [...byNumber.values()]
    .toSorted((a, b) => b.number - a.number)
    .map((p) => `- #${p.number} ${p.title} (${p.url})`)
    .join('\n');
}

function main() {
  const outputArg = process.argv.indexOf('--output');
  const outputPath =
    outputArg >= 0
      ? process.argv[outputArg + 1]
      : join(root, '.github/release-pr-body.generated.md');

  const { mainRef, devRef } = getMainDevRange();
  const commitLog = getCommitLog(mainRef, devRef);
  const mergedPrs = getMergedPrsInRange(mainRef, devRef);

  let body = readFileSync(templatePath, 'utf8');
  body = body.replace('{{MERGED_PRS}}', mergedPrs);
  body = body.replace('{{COMMIT_LOG}}', commitLog);

  writeFileSync(outputPath, body, 'utf8');
  console.log(`Generated: ${outputPath}`);
  console.log(`Range: ${mainRef.slice(0, 7)}..${devRef.slice(0, 7)}`);
}

main();
