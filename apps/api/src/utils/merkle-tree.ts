import { createHash } from 'crypto';

export interface MerkleTree {
  root: string;
  leaves: string[];
  layers: string[][];
}

export interface MerkleProof {
  leaf: string;
  leafIndex: number;
  proof: Array<{ hash: string; position: 'left' | 'right' }>;
  root: string;
}

function hashPair(left: string, right: string): string {
  return createHash('sha256').update(left + right).digest('hex');
}

export function buildMerkleTree(hashes: string[]): MerkleTree {
  if (hashes.length === 0) {
    throw new Error('Cannot build Merkle tree from empty array');
  }

  const layers: string[][] = [hashes.slice()];

  let currentLayer = layers[0];
  while (currentLayer.length > 1) {
    const nextLayer: string[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
      nextLayer.push(hashPair(left, right));
    }
    layers.push(nextLayer);
    currentLayer = nextLayer;
  }

  return {
    root: currentLayer[0],
    leaves: hashes.slice(),
    layers,
  };
}

export function getMerkleProof(tree: MerkleTree, leafIndex: number): MerkleProof {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(`Leaf index ${leafIndex} out of range [0, ${tree.leaves.length - 1}]`);
  }

  const proof: MerkleProof['proof'] = [];
  let index = leafIndex;

  for (let i = 0; i < tree.layers.length - 1; i++) {
    const layer = tree.layers[i];
    const isRight = index % 2 === 1;
    const siblingIndex = isRight ? index - 1 : index + 1;

    if (siblingIndex < layer.length) {
      proof.push({
        hash: layer[siblingIndex],
        position: isRight ? 'left' : 'right',
      });
    } else {
      // Odd node duplicated — sibling is itself
      proof.push({
        hash: layer[index],
        position: 'right',
      });
    }

    index = Math.floor(index / 2);
  }

  return {
    leaf: tree.leaves[leafIndex],
    leafIndex,
    proof,
    root: tree.root,
  };
}

export function verifyMerkleProof(proof: MerkleProof): boolean {
  let currentHash = proof.leaf;

  for (const step of proof.proof) {
    if (step.position === 'left') {
      currentHash = hashPair(step.hash, currentHash);
    } else {
      currentHash = hashPair(currentHash, step.hash);
    }
  }

  return currentHash === proof.root;
}
