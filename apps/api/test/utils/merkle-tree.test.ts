import assert from 'assert';
import { createHash } from 'crypto';
import { buildMerkleTree, getMerkleProof, verifyMerkleProof } from '../../src/utils/merkle-tree';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

describe('Merkle tree utilities', () => {
  describe('buildMerkleTree', () => {
    it('throws on empty array', () => {
      assert.throws(() => buildMerkleTree([]), /empty/);
    });

    it('returns the single leaf as root for 1 element', () => {
      const hash = sha256('hello');
      const tree = buildMerkleTree([hash]);
      assert.strictEqual(tree.root, hash);
      assert.strictEqual(tree.leaves.length, 1);
      assert.strictEqual(tree.layers.length, 1);
    });

    it('correctly computes root for 2 leaves', () => {
      const a = sha256('a');
      const b = sha256('b');
      const expectedRoot = sha256(a + b);

      const tree = buildMerkleTree([a, b]);
      assert.strictEqual(tree.root, expectedRoot);
      assert.strictEqual(tree.layers.length, 2);
    });

    it('handles odd number of leaves by duplicating the last', () => {
      const a = sha256('a');
      const b = sha256('b');
      const c = sha256('c');

      const tree = buildMerkleTree([a, b, c]);

      // Layer 0: [a, b, c]
      // Layer 1: [hash(a+b), hash(c+c)]
      // Layer 2: [hash(layer1[0] + layer1[1])]
      const ab = sha256(a + b);
      const cc = sha256(c + c);
      const expectedRoot = sha256(ab + cc);

      assert.strictEqual(tree.root, expectedRoot);
      assert.strictEqual(tree.leaves.length, 3);
    });

    it('handles power-of-2 leaves correctly', () => {
      const hashes = [sha256('a'), sha256('b'), sha256('c'), sha256('d')];
      const tree = buildMerkleTree(hashes);

      const ab = sha256(hashes[0] + hashes[1]);
      const cd = sha256(hashes[2] + hashes[3]);
      const expectedRoot = sha256(ab + cd);

      assert.strictEqual(tree.root, expectedRoot);
      assert.strictEqual(tree.layers.length, 3);
    });

    it('is deterministic', () => {
      const hashes = [sha256('x'), sha256('y'), sha256('z')];
      const tree1 = buildMerkleTree(hashes);
      const tree2 = buildMerkleTree(hashes);
      assert.strictEqual(tree1.root, tree2.root);
    });

    it('does not mutate the input array', () => {
      const hashes = [sha256('a'), sha256('b')];
      const copy = [...hashes];
      buildMerkleTree(hashes);
      assert.deepStrictEqual(hashes, copy);
    });
  });

  describe('getMerkleProof', () => {
    it('throws on out-of-range index', () => {
      const tree = buildMerkleTree([sha256('a'), sha256('b')]);
      assert.throws(() => getMerkleProof(tree, -1), /out of range/);
      assert.throws(() => getMerkleProof(tree, 2), /out of range/);
    });

    it('produces a valid proof for each leaf in a 4-element tree', () => {
      const hashes = [sha256('a'), sha256('b'), sha256('c'), sha256('d')];
      const tree = buildMerkleTree(hashes);

      for (let i = 0; i < hashes.length; i++) {
        const proof = getMerkleProof(tree, i);
        assert.strictEqual(proof.leaf, hashes[i]);
        assert.strictEqual(proof.leafIndex, i);
        assert.strictEqual(proof.root, tree.root);
        assert.ok(proof.proof.length > 0);
      }
    });

    it('produces a valid proof for a single-element tree', () => {
      const hash = sha256('only');
      const tree = buildMerkleTree([hash]);
      const proof = getMerkleProof(tree, 0);
      assert.strictEqual(proof.leaf, hash);
      assert.strictEqual(proof.root, hash);
      assert.strictEqual(proof.proof.length, 0);
    });
  });

  describe('verifyMerkleProof', () => {
    it('returns true for valid proofs', () => {
      const hashes = [sha256('a'), sha256('b'), sha256('c'), sha256('d'), sha256('e')];
      const tree = buildMerkleTree(hashes);

      for (let i = 0; i < hashes.length; i++) {
        const proof = getMerkleProof(tree, i);
        assert.strictEqual(verifyMerkleProof(proof), true, `Proof for leaf ${i} should be valid`);
      }
    });

    it('returns false if the leaf is tampered', () => {
      const hashes = [sha256('a'), sha256('b'), sha256('c'), sha256('d')];
      const tree = buildMerkleTree(hashes);
      const proof = getMerkleProof(tree, 1);

      const tamperedProof = { ...proof, leaf: sha256('tampered') };
      assert.strictEqual(verifyMerkleProof(tamperedProof), false);
    });

    it('returns false if a proof element is tampered', () => {
      const hashes = [sha256('a'), sha256('b'), sha256('c'), sha256('d')];
      const tree = buildMerkleTree(hashes);
      const proof = getMerkleProof(tree, 0);

      const tamperedProof = {
        ...proof,
        proof: proof.proof.map((step, i) =>
          i === 0 ? { ...step, hash: sha256('fake') } : step
        ),
      };
      assert.strictEqual(verifyMerkleProof(tamperedProof), false);
    });

    it('returns false if the root is tampered', () => {
      const hashes = [sha256('a'), sha256('b')];
      const tree = buildMerkleTree(hashes);
      const proof = getMerkleProof(tree, 0);

      const tamperedProof = { ...proof, root: sha256('wrong-root') };
      assert.strictEqual(verifyMerkleProof(tamperedProof), false);
    });

    it('returns true for a single-element tree', () => {
      const hash = sha256('solo');
      const tree = buildMerkleTree([hash]);
      const proof = getMerkleProof(tree, 0);
      assert.strictEqual(verifyMerkleProof(proof), true);
    });
  });
});
