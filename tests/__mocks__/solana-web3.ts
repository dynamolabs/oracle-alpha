// Mock for @solana/web3.js
export class Connection {
  constructor(endpoint: string) {}

  async getParsedTokenAccountsByOwner(owner: any, filter: any) {
    return { value: [] };
  }
}

export class PublicKey {
  constructor(value: string) {}

  toString() {
    return 'MockPublicKey';
  }

  toBase58() {
    return 'MockPublicKeyBase58';
  }
}

export const LAMPORTS_PER_SOL = 1000000000;
