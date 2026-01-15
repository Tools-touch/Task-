import {
  Keypair,
  Connection,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import {
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToCheckedInstruction,
  getAssociatedTokenAddressSync,
  getMinimumBalanceForRentExemptMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import "dotenv/config";

import bs58 from "bs58";

const feePayer = Keypair.fromSecretKey(
  bs58.decode(process.env.SECRET || "")
);

const connection = new Connection(process.env.RPC_ENDPOINT || "", "confirmed");

async function main() {
  try {
    const mint = Keypair.generate();
    const mintRent = await getMinimumBalanceForRentExemptMint(connection);

    // 1) Create mint account (SystemProgram.createAccount)
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: feePayer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MINT_SIZE,
      lamports: mintRent,
      programId: TOKEN_PROGRAM_ID,
    });

    // 2) Initialize mint (decimals=6, mintAuthority=feePayer, freezeAuthority=feePayer)
    const decimals = 6;
    const initializeMintIx = createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      feePayer.publicKey,
      feePayer.publicKey,
      TOKEN_PROGRAM_ID
    );

    // 3) Create ATA for feePayer
    const associatedTokenAccount = getAssociatedTokenAddressSync(
      mint.publicKey,
      feePayer.publicKey,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const createAssociatedTokenAccountIx = createAssociatedTokenAccountInstruction(
      feePayer.publicKey,          // payer
      associatedTokenAccount,       // ata
      feePayer.publicKey,          // owner
      mint.publicKey,              // mint
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    // 4) Mint 21,000,000 tokens to ATA (checked)
    const mintAmount = BigInt(21_000_000) * BigInt(10 ** decimals);

    const mintToCheckedIx = createMintToCheckedInstruction(
      mint.publicKey,              // mint
      associatedTokenAccount,       // destination
      feePayer.publicKey,          // authority (mintAuthority)
      mintAmount,                  // amount (base units)
      decimals,                    // decimals
      [],                          // multiSigners
      TOKEN_PROGRAM_ID
    );

    const recentBlockhash = await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      feePayer: feePayer.publicKey,
      blockhash: recentBlockhash.blockhash,
      lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
    }).add(
      createAccountIx,
      initializeMintIx,
      createAssociatedTokenAccountIx,
      mintToCheckedIx
    );

    // 5) Signers: feePayer pays + signs mintTo authority, mint signs account creation
    const transactionSignature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [feePayer, mint]
    );

    console.log("Mint Address:", mint.publicKey.toBase58());
    console.log("ATA Address:", associatedTokenAccount.toBase58());
    console.log("Transaction Signature:", transactionSignature);
  } catch (error) {
    console.error(`Oops, something went wrong: ${error}`);
  }
}

main();
