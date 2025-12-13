import { TestRepoBuilder } from './harness/test-repo-builder';
import { getGit } from '../src/projection-env';
import { project } from '../src/projector';
import { validateProjection } from '../src/validator';
import { reconstruct } from '../src/reconstructor';
import { strict as assert } from 'assert';
import { promises as fs } from 'fs';
import path from 'path';

// Helper to log sections of the validation
function logStep(title: string) {
  console.log(`\n\n--- ${title} ---`);
}

async function main() {
  logStep('1. Preparation');
  const repoBuilder = await TestRepoBuilder.create();
  const git = getGit(repoBuilder.repoPath);
  console.log(`Test repository created at: ${repoBuilder.repoPath}`);

  // --- Step 1: Linear History Projection ---
  logStep('2. Step 1: Linear History Projection');
  const c0 = await repoBuilder.commit('C0: Add fileA.txt', { 'fileA.txt': 'content a' });
  console.log(`Source C0: ${c0}`);
  const pC0 = await project(git, c0);
  console.log(`Projected P0: ${pC0}`);
  assert.strictEqual(await validateProjection(git, pC0), true, 'P0 validation failed');
  console.log('✅ P0 Validated');

  const c1 = await repoBuilder.commit('C1: Modify fileA.txt', { 'fileA.txt': 'content a modified' });
  console.log(`Source C1: ${c1}`);
  const pC1 = await project(git, c1);
  console.log(`Projected P1: ${pC1}`);
  assert.strictEqual(await validateProjection(git, pC1), true, 'P1 validation failed');
  console.log('✅ P1 Validated');

  const c2 = await repoBuilder.commit('C2: Add fileB.txt', { 'fileB.txt': 'content b' });
  console.log(`Source C2: ${c2}`);
  const pC2 = await project(git, c2);
  console.log(`Projected P2: ${pC2}`);
  assert.strictEqual(await validateProjection(git, pC2), true, 'P2 validation failed');
  console.log('✅ P2 Validated');

  // --- Step 2: Merge Commit Projection ---
  logStep('3. Step 2: Merge Commit Projection');
  await git.checkout(['-b', 'feature', c2]);
  const f1 = await repoBuilder.commit('F1: Add fileC.txt', { 'fileC.txt': 'content c' });
  console.log(`Source F1: ${f1}`);

  await git.checkout('main');
  // This is not a conflict, but a fast-forward merge would be too simple. So we add a commit on main too.
  const c3 = await repoBuilder.commit('C3: Modify fileB.txt again', { 'fileB.txt': 'content b modified' });
  console.log(`Source C3: ${c3}`);

  await git.merge(['feature']);
  const mergeCommit = await git.revparse(['HEAD']);
  console.log(`Source Merge M1: ${mergeCommit}`);

  // Project the linear commits on the branches
  await project(git, f1);
  await project(git, c3);
  const pM1 = await project(git, mergeCommit);
  console.log(`Projected PM1: ${pM1}`);
  assert.strictEqual(await validateProjection(git, pM1), true, 'PM1 validation failed');
  console.log('✅ PM1 Validated (P4)');

  // --- Step 3: Reconstruction Proof ---
  logStep('4. Step 3: Reconstruction Proof');
  const outputDir = '/tmp/e2e-reconstruction';
  await reconstruct(git, pM1, outputDir);
  const tempGit = getGit(outputDir);
  await tempGit.init();
  await tempGit.add('.');
  const reconstructedTree = (await tempGit.raw(['write-tree'])).trim();
  const sourceTree = await git.revparse([`${mergeCommit}^{tree}`]);
  assert.strictEqual(reconstructedTree, sourceTree, 'Reconstructed tree does not match source tree (P1)');
  console.log('✅ Reconstructed tree matches source (P1)');
  await fs.rm(outputDir, { recursive: true, force: true });

  // --- Step 4: Repeatability & Idempotency ---
  logStep('5. Step 4: Repeatability & Idempotency');
  const pM1_rerun = await project(git, mergeCommit);
  assert.strictEqual(pM1_rerun, pM1, 'Idempotency check failed (P2, P3)');
  console.log('✅ Idempotency check passed (P2, P3)');

  logStep('🏁 End-to-End Validation Successful!');

  await repoBuilder.cleanup();
}

main().catch(err => {
  console.error('Validation Failed:', err);
  process.exit(1);
});
