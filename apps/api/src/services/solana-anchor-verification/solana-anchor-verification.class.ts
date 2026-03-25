import { BadRequest } from '@feathersjs/errors';
import { Sequelize } from 'sequelize';
import type { Application, SolanaAnchor, SolanaAnchorLeaf } from '../../declarations';
import { buildMerkleTree, getMerkleProof, MerkleProof } from '../../utils/merkle-tree';
import { verifyMemoTransaction, MemoVerificationResult } from '../../utils/solana-client';

export interface AnchorVerificationResult {
  recordId?: string;
  anchorId?: string;
  chainType: 'encounters' | 'access_logs';
  anchored: boolean;
  anchor?: {
    id: string;
    merkleRoot: string;
    txSignature: string | null;
    slot: number | null;
    network: string;
    leafCount: number;
    confirmedAt: string | null;
  };
  proof?: MerkleProof;
  solanaVerified?: boolean;
}

export class SolanaAnchorVerification {
  app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  async find(params: any): Promise<AnchorVerificationResult> {
    const recordId = params.query?.recordId;
    const anchorId = params.query?.anchorId;
    const chainType = params.query?.chainType;
    const verifyOnChain = params.query?.verifyOnChain === 'true' || params.query?.verifyOnChain === true;

    const sequelize: Sequelize = this.app.get('sequelizeClient');
    const LeafModel = sequelize.models.solana_anchor_leaves;
    const AnchorModel = sequelize.models.solana_anchors;

    // Mode 1: Verify a specific anchor directly (for admin "verify all")
    if (anchorId) {
      const anchor = await AnchorModel.findByPk(anchorId, { raw: true }) as unknown as SolanaAnchor | null;
      if (!anchor || anchor.status !== 'confirmed' || !anchor.txSignature) {
        return { anchorId, chainType: anchor?.chainType || 'encounters', anchored: false };
      }

      const result: AnchorVerificationResult = {
        anchorId,
        chainType: anchor.chainType,
        anchored: true,
        anchor: {
          id: anchor.id as string,
          merkleRoot: anchor.merkleRoot,
          txSignature: anchor.txSignature,
          slot: anchor.slot,
          network: anchor.network,
          leafCount: anchor.leafCount,
          confirmedAt: anchor.updatedAt ? new Date(anchor.updatedAt).toISOString() : null,
        },
      };

      try {
        const verification = await verifyMemoTransaction(anchor.txSignature, anchor.merkleRoot);
        result.solanaVerified = verification.verified;
      } catch {
        result.solanaVerified = false;
      }

      return result;
    }

    // Mode 2: Verify a specific record by ID (for per-encounter verification)
    if (!recordId) {
      throw new BadRequest('recordId or anchorId query parameter is required');
    }
    if (!chainType || !['encounters', 'access_logs'].includes(chainType)) {
      throw new BadRequest('chainType query parameter is required (encounters or access_logs)');
    }

    // Find the leaf for this record
    const leaf = await LeafModel.findOne({
      where: { recordId },
      raw: true,
    }) as unknown as SolanaAnchorLeaf | null;

    if (!leaf) {
      return { recordId, chainType, anchored: false };
    }

    // Fetch the anchor
    const anchor = await AnchorModel.findByPk(leaf.anchorId, {
      raw: true,
    }) as unknown as SolanaAnchor | null;

    if (!anchor || anchor.chainType !== chainType) {
      return { recordId, chainType, anchored: false };
    }

    // Fetch all leaves for this anchor to reconstruct the Merkle tree
    const allLeaves = await LeafModel.findAll({
      where: { anchorId: anchor.id },
      order: [['leafIndex', 'ASC']],
      raw: true,
    }) as unknown as SolanaAnchorLeaf[];

    const hashes = allLeaves.map((l) => l.recordHash);
    const tree = buildMerkleTree(hashes);
    const proof = getMerkleProof(tree, leaf.leafIndex);

    const result: AnchorVerificationResult = {
      recordId,
      chainType,
      anchored: true,
      anchor: {
        id: anchor.id as string,
        merkleRoot: anchor.merkleRoot,
        txSignature: anchor.txSignature,
        slot: anchor.slot,
        network: anchor.network,
        leafCount: anchor.leafCount,
        confirmedAt: anchor.status === 'confirmed' && anchor.updatedAt
          ? new Date(anchor.updatedAt).toISOString()
          : null,
      },
      proof,
    };

    if (verifyOnChain && anchor.txSignature && anchor.status === 'confirmed') {
      try {
        const verification: MemoVerificationResult = await verifyMemoTransaction(
          anchor.txSignature,
          anchor.merkleRoot
        );
        result.solanaVerified = verification.verified;
      } catch {
        result.solanaVerified = false;
      }
    }

    return result;
  }
}
