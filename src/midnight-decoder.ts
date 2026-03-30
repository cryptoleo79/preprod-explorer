/**
 * Midnight Transaction Decoder
 * Parses sendMnTransaction args to extract readable data
 */

interface DecodedTransaction {
  version: string;
  signatureType: string;
  proofType: string;
  rawHeader: string;
  identifiers: string[];
  contractAddresses: string[];
  transactionType?: string;
  shieldingType?: 'shielded' | 'unshielded' | 'mixed' | 'unknown';
  operations: string[];
}

export function decodeMidnightTransaction(argsJson: string): DecodedTransaction | null {
  try {
    const args = JSON.parse(argsJson);
    if (!Array.isArray(args) || args.length === 0) return null;

    let hexData = args[0];
    if (typeof hexData !== 'string') return null;
    if (hexData.startsWith('0x')) hexData = hexData.slice(2);

    // Decode hex to find header and readable strings
    const decoded = Buffer.from(hexData, 'hex').toString('utf8');

    // Check for midnight:transaction header
    let version = 'unknown';
    let signatureType = 'unknown';
    let proofType = 'unknown';
    let rawHeader = '';

    if (decoded.startsWith('midnight:transaction')) {
      const versionMatch = decoded.match(/midnight:transaction\[v(\d+)\]/);
      if (versionMatch) {
        version = `v${versionMatch[1]}`;
      }

      const typesMatch = decoded.match(/\(signature\[v(\d+)\],([^,]+),([^)]+)\)/);
      if (typesMatch) {
        signatureType = `v${typesMatch[1]}`;
        proofType = typesMatch[3];
      }

      const headerEnd = decoded.indexOf('):');
      if (headerEnd > 0) {
        rawHeader = decoded.slice(0, headerEnd + 2);
      }
    }

    // Extract operations and shielding type from decoded data
    const operations = extractOperations(decoded);
    const shieldingType = classifyShielding(operations);
    const identifiers = extractIdentifiers(hexData);

    return {
      version,
      signatureType,
      proofType,
      rawHeader: rawHeader || decoded.slice(0, 80),
      identifiers: identifiers.slice(0, 10),
      contractAddresses: [],
      transactionType: detectType(decoded, operations),
      shieldingType,
      operations,
    };
  } catch (e) {
    return null;
  }
}

/**
 * Quick classification of a midnight transaction's shielding type
 * without full decoding - used for stats aggregation
 */
export function classifyMidnightTx(argsJson: string): { shieldingType: string; txType: string } {
  try {
    const args = JSON.parse(argsJson);
    if (!Array.isArray(args) || args.length === 0) return { shieldingType: 'unknown', txType: 'unknown' };

    let hexData = args[0];
    if (typeof hexData !== 'string') return { shieldingType: 'unknown', txType: 'unknown' };
    if (hexData.startsWith('0x')) hexData = hexData.slice(2);

    const decoded = Buffer.from(hexData, 'hex').toString('utf8');
    const operations = extractOperations(decoded);

    return {
      shieldingType: classifyShielding(operations),
      txType: detectType(decoded, operations),
    };
  } catch {
    return { shieldingType: 'unknown', txType: 'unknown' };
  }
}

function extractOperations(decoded: string): string[] {
  const ops: string[] = [];

  // Known Midnight operation patterns found in tx hex data
  const patterns = [
    // Shielded/unshielded operations
    'mint_shielded_to_user',
    'mint_unshielded_to_user',
    'transfer_shielded',
    'transfer_unshielded',
    'shield',
    'unshield',
    // Token operations
    'mintFixedSupply',
    'burn',
    // DeFi/DEX operations
    'injectLiquidityOrder',
    'depositOrder',
    'settleOne',
    'swap',
    // Contract operations
    'deploy',
    'check_balance',
  ];

  for (const p of patterns) {
    if (decoded.includes(p)) {
      ops.push(p);
    }
  }

  return ops;
}

function classifyShielding(operations: string[]): 'shielded' | 'unshielded' | 'mixed' | 'unknown' {
  const hasShielded = operations.some(op =>
    op.includes('shielded') && !op.includes('unshielded')
  );
  const hasUnshielded = operations.some(op => op.includes('unshielded'));

  if (hasShielded && hasUnshielded) return 'mixed';
  if (hasShielded) return 'shielded';
  if (hasUnshielded) return 'unshielded';

  // Check for shield/unshield standalone ops
  if (operations.includes('shield')) return 'shielded';
  if (operations.includes('unshield')) return 'unshielded';

  return 'unknown';
}

function extractIdentifiers(hexData: string): string[] {
  const ids: string[] = [];
  const matches = hexData.match(/[0-9a-f]{64}/gi) || [];

  for (const m of matches) {
    if (!/^0+$/.test(m) && !/^(.)\1+$/.test(m)) {
      const formatted = '0x' + m;
      if (!ids.includes(formatted)) ids.push(formatted);
    }
  }
  return ids;
}

function detectType(decoded: string, operations: string[]): string {
  if (operations.some(op => op.includes('deploy'))) return 'contract_deploy';
  if (operations.some(op => op.includes('transfer'))) return 'transfer';
  if (operations.some(op => op.includes('mintFixedSupply'))) return 'token_mint';
  if (operations.some(op => op.includes('mint'))) return 'mint';
  if (operations.some(op => op.includes('injectLiquidityOrder'))) return 'dex_liquidity';
  if (operations.some(op => op.includes('depositOrder'))) return 'dex_deposit';
  if (operations.some(op => op.includes('settleOne'))) return 'dex_settle';
  if (operations.some(op => op.includes('swap'))) return 'swap';
  if (operations.some(op => op.includes('burn'))) return 'burn';
  if (decoded.includes('check_balance')) return 'balance_check';
  if (decoded.includes('ESCROW') || decoded.includes('FIXED_SUPPLY')) return 'contract_call';
  if (decoded.includes('mainnet') || decoded.includes('preprod') || decoded.includes('preview')) return 'contract_call';
  return 'transaction';
}
