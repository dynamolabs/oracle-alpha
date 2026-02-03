// Token metadata utilities

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '5d079301-97d2-4ae9-81fd-e56f00a891f4';

interface TokenMetadata {
  address: string;
  symbol: string;
  name: string;
  decimals?: number;
  image?: string;
}

// Cache to avoid repeated lookups
const metadataCache = new Map<string, TokenMetadata>();

export async function getTokenMetadata(address: string): Promise<TokenMetadata> {
  // Check cache first
  if (metadataCache.has(address)) {
    return metadataCache.get(address)!;
  }

  try {
    // Try Helius DAS API
    const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'metadata',
        method: 'getAsset',
        params: { id: address }
      })
    });

    const data = await response.json();
    const content = data.result?.content;
    const meta = content?.metadata;

    const result: TokenMetadata = {
      address,
      symbol: meta?.symbol || 'UNKNOWN',
      name: meta?.name || 'Unknown Token',
      decimals: data.result?.token_info?.decimals,
      image: content?.links?.image || content?.files?.[0]?.uri
    };

    metadataCache.set(address, result);
    return result;
  } catch (error) {
    // Fallback: try DexScreener
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
      const data = await response.json();
      const pair = data.pairs?.[0];

      if (pair) {
        const result: TokenMetadata = {
          address,
          symbol: pair.baseToken?.symbol || 'UNKNOWN',
          name: pair.baseToken?.name || 'Unknown Token',
          image: pair.info?.imageUrl
        };
        metadataCache.set(address, result);
        return result;
      }
    } catch {}

    // Return unknown
    const unknown: TokenMetadata = {
      address,
      symbol: 'UNKNOWN',
      name: 'Unknown Token'
    };
    metadataCache.set(address, unknown);
    return unknown;
  }
}

export async function batchGetMetadata(addresses: string[]): Promise<Map<string, TokenMetadata>> {
  const results = new Map<string, TokenMetadata>();
  
  // Process in parallel with limit
  const batchSize = 5;
  for (let i = 0; i < addresses.length; i += batchSize) {
    const batch = addresses.slice(i, i + batchSize);
    const promises = batch.map(addr => getTokenMetadata(addr));
    const metadata = await Promise.all(promises);
    
    for (let j = 0; j < batch.length; j++) {
      results.set(batch[j], metadata[j]);
    }
  }
  
  return results;
}

export function clearCache() {
  metadataCache.clear();
}
