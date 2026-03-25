import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';

const mnemonic = bip39.generateMnemonic();
const seed = bip39.mnemonicToSeedSync(mnemonic);
const derivedSeed = derivePath('m/44\'/501\'/0\'/0\'', seed.toString('hex')).key;
const keypair = Keypair.fromSeed(derivedSeed);

console.log('Mnemonic:', mnemonic);
console.log('Public Key:', keypair.publicKey.toBase58());
console.log('Secret Key (Base58):', bs58.encode(keypair.secretKey));
