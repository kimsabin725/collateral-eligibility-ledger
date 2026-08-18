'use strict';
/**
 * Thin client for the Attestcoin Proof Builder API.
 *
 * The hosted service computes Merkle inclusion + continuity proofs for a source-chain
 * transaction, so a dApp does not have to run proving infrastructure itself.
 * Endpoints below come from the live OpenAPI spec at
 *   <proofBuilderUrl>/api/swagger/openapi.json  (read 2026-08-17)
 */

const { CC3_TESTNET } = require('./config');

class ProofBuilderClient {
  constructor(baseUrl = CC3_TESTNET.proofBuilderUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async #get(path) {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ProofBuilder ${res.status} ${res.statusText} for ${url}`);
    }
    return res.json();
  }

  /** Upstream health, including whether the CC3 and Ethereum RPCs are reachable. */
  health() {
    return this.#get('/health');
  }

  /**
   * Highest source-chain block the attestor set has committed to on Creditcoin.
   * A transaction can only be proven once its block is at or below this height.
   */
  async attestedHeight(chainKey) {
    const { attestedHeight } = await this.#get(`/attested-height/${chainKey}`);
    return attestedHeight;
  }

  /** Full proof bundle for a source transaction, addressed by hash. */
  proofByTxHash(chainKey, txHash) {
    return this.#get(`/proof-by-tx/${chainKey}/${txHash}`);
  }

  /** Full proof bundle addressed by (block height, transaction index). */
  proofByPosition(chainKey, headerNumber, txIndex) {
    return this.#get(`/proof/${chainKey}/${headerNumber}/${txIndex}`);
  }

  /**
   * Block until `height` has been attested, polling `attestedHeight`.
   * Mirrors the SDK's `waitUntilHeightAttested`. Measured lag on Sepolia was ~41 blocks
   * (~8 min) on 2026-08-17, so budget minutes, not seconds, in any live demo.
   */
  async waitUntilAttested(chainKey, height, { intervalMs = 15000, timeoutMs = 1800000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const current = await this.attestedHeight(chainKey);
      if (current >= height) return current;
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for height ${height} (attested: ${current})`);
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
}

/** Reshape a proof-builder response into the tuple order the precompile ABI expects. */
function toVerifierArgs(proof) {
  return {
    chainKey: proof.chainKey,
    height: proof.headerNumber,
    encodedTransaction: proof.txBytes,
    merkleProof: [proof.merkleProof.root, proof.merkleProof.siblings.map((s) => [s.hash, s.isLeft])],
    continuityProof: [proof.continuityProof.lowerEndpointDigest, proof.continuityProof.roots],
  };
}

module.exports = { ProofBuilderClient, toVerifierArgs };
