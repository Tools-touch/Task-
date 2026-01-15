# Task1 学习记录，TS版本

### 创建task1 工程
- 命令行创建
``` bash
mkdir task1
cd task1
```

- 也可手动创建该文件夹，再进入终端

### 工程初始化
- 在终端上运行
```bash
npm i -D typescript ts-node @types/node
```
 安装项目所需要的库

```bash
npm i @solana/web3.js @solana/spl-token bs58 dotenv
```

- 文档配置
  

配置 package.json,在里面添加
```
  "type": "module",
  "scripts": {
    "mint": "node mint.ts"
  },
```


配置tsconfig.json
```
    "types": ["node"]
```

### 编写代码

- 在目录下创建 `.env`
```
RPC_ENDPOINT=https://api.devnet.solana.com
SECRET=你的私钥
```

- 使用`web3.js` 铸造一个 SPL Token代码
- 在`blueshift`上提交代码时，去掉 `import "dotenv/config";`
- 创建 `mint.ts` 文件，编写代码
```typescript
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
console.log("RPC_ENDPOINT =", process.env.RPC_ENDPOINT);

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

```

### 运行代码和在浏览器中查看
如果是本地的查看不了，需要第三方或者官方的`RPC`才能查看

- 运行
```bash
npm run mint 
```

- 结果
```bash
╰─> npm run mint


> mint
> node mint.ts

Mint Address: 5z4XkA99Ez44z2zyAbVYuCChCxXYWxHfW9MxTJWXo5ZG
ATA Address: 5Eo78Smqt7jP61rTjCr7n9H4o96DHVTQN891AEXpzS7X
Transaction Signature: 5ucFAj3UAnYtA8LEAwqq9jR1RmsDWayyKSQLpY5PhZz7fqHSR11ya3KxMGbixn2ahaeSkndnNY8NzwT1oYBwb49N
```

- 在浏览器里看（devnet）

脚本打印 tx 后直接打开：

`https://explorer.solana.com/tx/<tx>?cluster=devnet`

`https://explorer.solana.com/address/<mint>?cluster=devnet`

`https://explorer.solana.com/address/<ata>?cluster=devnet`



## 常见问题：
## 一、如何创建钱包

在终端运行：

```
solana-keygen new
```

你会看到类似提示：

```
Generating a new keypair
For added security, enter a BIP39 passphrase
BIP39 Passphrase (empty for none):
```

直接回车即可（不设密码也可以）。

然后会显示：

```
Wrote new keypair to /Users/你/.config/solana/id.json
================================================================
pubkey: 9fZr...
================================================================
Save this seed phrase and your BIP39 passphrase to recover your new keypair:
apple tiger river ...
```

**重点：**

- `pubkey` 就是你的钱包地址
- 那 12 个英文单词是你的助记词，一定要保存好

**配置RPC并获取SOL**

```bash
solana config set --url https://api.devnet.solana.com
solana airdrop 2
solana balance
```

###  二、 .env 文件

#### 1. `SECRET` 如何获取？
- 在终端中运行获取，前提需要创建好钱包

```bash
node --input-type=module -e "import fs from 'fs'; import os from 'os'; import bs58 from 'bs58'; const p=os.homedir()+'/.config/solana/id.json'; const arr=Uint8Array.from(JSON.parse(fs.readFileSync(p,'utf8'))); console.log(arr.length); console.log(bs58.encode(arr));"
```
#### 2. `RPC_ENDPOINT` 如何填写
(1) 官方的`RPC`节点
- 链接：`https://api.devnet.solana.com`
- 缺点：慢，提交超时等


(2) 本地节点
- 需要在终端运行`solana-test-validator --reset`
- 链接：`http://127.0.0.1:8899`
- 缺点：无法在浏览器中查看
- 需要在运行配置，改配置，获取`solana`
```
solana config set --url http://127.0.0.1:8899
solana airdrop 10
solana balance
```

(3) 第三方节点
- 官网：`https://www.helius.dev/`

- 使用 `谷歌`、`Github`、`钱包` 登录

- 缺点：本地配置时，`airdrop` 不了，需要使用官方`RPC`的才能`airdrop`

- 链接：复制 `RPC` 节点，复制时需要把网络切换为 `Devnet` 模式
  ![alt text](image-1.png)

  

