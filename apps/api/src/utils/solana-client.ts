import {
  Connection,
  Keypair,
  Transaction,
  TransactionInstruction,
  PublicKey,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import logger from "../logger";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

let cachedConnection: Connection | null = null;
let cachedKeypair: Keypair | null = null;

function resolveRpcUrl(network: string): string {
  switch (network) {
    case "devnet":
      return "https://api.devnet.solana.com";
    case "mainnet-beta":
      return "https://api.mainnet-beta.solana.com";
    default:
      return network;
  }
}

export function getSolanaNetwork(): string {
  if (process.env.SOLANA_NETWORK) return process.env.SOLANA_NETWORK;
  return process.env.NODE_ENV === "production" ? "mainnet-beta" : "devnet";
}

export function getSolanaConnection(): Connection {
  if (cachedConnection) return cachedConnection;
  const rpcUrl = resolveRpcUrl(getSolanaNetwork());
  cachedConnection = new Connection(rpcUrl, "confirmed");
  return cachedConnection;
}

export function getSolanaKeypair(): Keypair | null {
  if (cachedKeypair) return cachedKeypair;

  const encoded = process.env.SOLANA_KEYPAIR;
  if (!encoded) return null;

  try {
    const secretKey = bs58.decode(encoded);
    cachedKeypair = Keypair.fromSecretKey(secretKey);
    return cachedKeypair;
  } catch {
    logger.warn(
      "Solana anchoring: SOLANA_KEYPAIR is malformed, anchoring disabled",
    );
    return null;
  }
}

export interface MemoSubmissionResult {
  signature: string;
  slot: number;
}

export async function submitMemoTransaction(
  merkleRoot: string,
  metadata: { type: string; count: number },
): Promise<MemoSubmissionResult> {
  const keypair = getSolanaKeypair();
  if (!keypair) {
    throw new Error("Solana keypair not available");
  }

  const connection = getSolanaConnection();

  const memoData = JSON.stringify({
    root: merkleRoot,
    type: metadata.type,
    count: metadata.count,
    ts: new Date().toISOString(),
  });

  const instruction = new TransactionInstruction({
    keys: [{ pubkey: keypair.publicKey, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memoData, "utf-8"),
  });

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [keypair],
    {
      commitment: "confirmed",
    },
  );

  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  return {
    signature,
    slot: tx?.slot ?? 0,
  };
}

export interface MemoVerificationResult {
  verified: boolean;
  reason?: "not_found" | "mismatch";
  slot: number;
  blockTime: number | null;
}

async function fetchTransaction(connection: Connection, signature: string) {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (tx) return tx;

  // Retry once after 500ms — public RPCs may rate-limit with a null response
  await new Promise((r) => setTimeout(r, 500));
  return connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
}

function matchMerkleRootInTx(tx: any, expectedMerkleRoot: string): boolean {
  const logMessages = tx.meta?.logMessages || [];
  const memoLog = logMessages.find((log: string) =>
    log.startsWith("Program log: Memo"),
  );

  if (!memoLog) {
    const message = tx.transaction.message;
    const instructions = message.compiledInstructions || [];
    for (const ix of instructions) {
      try {
        const data = Buffer.from(ix.data).toString("utf-8");
        const parsed = JSON.parse(data);
        if (parsed.root === expectedMerkleRoot) return true;
      } catch {
        continue;
      }
    }
  }

  for (const log of logMessages) {
    if (log.includes(expectedMerkleRoot)) return true;
  }

  return false;
}

export async function verifyMemoTransaction(
  signature: string,
  expectedMerkleRoot: string,
): Promise<MemoVerificationResult> {
  const connection = getSolanaConnection();
  const tx = await fetchTransaction(connection, signature);

  if (!tx) {
    return { verified: false, reason: "not_found", slot: 0, blockTime: null };
  }

  const verified = matchMerkleRootInTx(tx, expectedMerkleRoot);
  return {
    verified,
    reason: verified ? undefined : "mismatch",
    slot: tx.slot,
    blockTime: tx.blockTime ?? null,
  };
}

// --- Batch verification via concurrent Promise.all chunks ---

const BATCH_SIZE = 5;

export interface BatchVerifyItem {
  signature: string;
  expectedMerkleRoot: string;
}

export interface BatchVerifyResult {
  signature: string;
  result: MemoVerificationResult;
}

export async function batchVerifyTransactions(
  items: BatchVerifyItem[],
): Promise<BatchVerifyResult[]> {
  const results: BatchVerifyResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);

    const chunkResults = await Promise.all(
      chunk.map((item) =>
        verifyMemoTransaction(item.signature, item.expectedMerkleRoot),
      ),
    );

    for (let j = 0; j < chunk.length; j++) {
      results.push({ signature: chunk[j].signature, result: chunkResults[j] });
    }

    // Delay between requests to avoid rate limiting (mainnet-beta public RPC is strict)
    if (i + BATCH_SIZE < items.length) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return results;
}

export async function getWalletBalance(): Promise<number | null> {
  const keypair = getSolanaKeypair();
  if (!keypair) return null;

  try {
    const connection = getSolanaConnection();
    const balance = await connection.getBalance(keypair.publicKey);
    return balance / 1e9; // Convert lamports to SOL
  } catch {
    return null;
  }
}
