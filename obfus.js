// obfus.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { minify } = require('terser');

/* =========================
   Utils: random + noise
   ========================= */
function randomName(len = 8) {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const chars = letters + '0123456789';
  let name = letters[Math.floor(Math.random() * letters.length)];
  for (let i = 1; i < len; i++) name += chars[Math.floor(Math.random() * chars.length)];
  return name;
}

function makeNoiseComment() {
  const ZW = "\u200B\u200C\u200D\u2060\uFEFF"; // zero-width
  const EMOJI = ["🦠","😈","🤖","🔥","👾","💀","🛸","✨","🧟‍♂️","🌑","🌀"];
  const zws = ZW[Math.floor(Math.random() * ZW.length)];
  const emo = EMOJI[Math.floor(Math.random() * EMOJI.length)];
  return `/*${emo}${zws}\\x00${zws}${emo}*/`;
}

function addNoisyComments(code, ratio = 0.35) {
  const parts = code.split(';');
  for (let i = 0; i < parts.length - 1; i++) {
    parts[i] += (Math.random() < ratio) ? ';' + makeNoiseComment() : ';';
  }
  return parts.join('');
}

/* =========================
   Crypto helpers (AES)
   ========================= */
function aesEncryptUtf8ToB64(text, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let enc = cipher.update(text, 'utf8', 'base64');
  enc += cipher.final('base64');
  return enc;
}

function aesKeyFromPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32);
}

/* =========================
   Multi-layer Encoders (tanpa NATO)
   (binary, hex, octal)
   ========================= */
// binary <-> utf8
const binEncode = (s) => Buffer.from(s, 'utf8')
  .toString('binary')
  .split('')
  .map(ch => ch.charCodeAt(0).toString(2).padStart(8, '0'))
  .join('.');
const binDecode = (b) => {
  const bytes = b.split('.').map(bits => parseInt(bits, 2));
  return Buffer.from(Uint8Array.from(bytes)).toString('utf8');
};

// hex <-> utf8
const hexEncode = (s) => Buffer.from(s, 'utf8').toString('hex');
const hexDecode = (h) => Buffer.from(h, 'hex').toString('utf8');

// octal <-> utf8
const octEncode = (s) => Buffer.from(s, 'utf8')
  .toString('binary')
  .split('')
  .map(ch => ch.charCodeAt(0).toString(8))
  .join('-');
const octDecode = (o) => {
  const bytes = o.split('-').map(v => parseInt(v, 8));
  return Buffer.from(Uint8Array.from(bytes)).toString('utf8');
};

// pipeline encode/decode
const LAYERS = {
  bin: { enc: binEncode, dec: binDecode },
  hex: { enc: hexEncode, dec: hexDecode },
  oct: { enc: octEncode, dec: octDecode }
  // NATO dihapus
};

function applyLayersEncode(str, order) {
  return order.reduce((acc, name) => LAYERS[name].enc(acc), str);
}

function applyLayersDecode(str, order) {
  return order.slice().reverse().reduce((acc, name) => LAYERS[name].dec(acc), str);
}

// pilih urutan layer acak (hanya bin, hex, oct)
function pickLayerOrder() {
  const arr = ['bin', 'hex', 'oct'];
  // shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* =========================
   Core obfuscation
   ========================= */
async function obfuscate(inputFile, password = "0x1bc6e7d2e025f57ff79917f5e72561327b751105") {
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File '${inputFile}' tidak ditemukan.`);
    process.exit(1);
  }

  const original = fs.readFileSync(inputFile, 'utf8');
  console.log(`📖 Membaca file: ${inputFile}`);

  // ====== Derive key dari password ======
  const salt = crypto.randomBytes(16);
  const derivedKey = aesKeyFromPassword(password, salt);

  // ====== Enkripsi payload ======
  const payloadIv = crypto.randomBytes(16);
  const payloadEnc = aesEncryptUtf8ToB64(original, derivedKey, payloadIv);
  console.log(`🔐 Payload terenkripsi (${payloadEnc.length} chars)`);

  // ====== Random layer order ======
  const orderPayload = pickLayerOrder(); // untuk payload
  const orderKeyMat  = pickLayerOrder(); // untuk key & iv

  // Bungkus ciphertext
  const wrappedPayload = applyLayersEncode(payloadEnc, orderPayload);

  // Bungkus key & iv
  const derivedKeyB64 = derivedKey.toString('base64');
  const payloadIvB64  = payloadIv.toString('base64');

  const wrappedKey = applyLayersEncode(derivedKeyB64, orderKeyMat);
  const wrappedIv  = applyLayersEncode(payloadIvB64, orderKeyMat);

  // ====== Inner stub ======
  const vCrypto = randomName();
  const vOrderP = randomName();
  const vOrderK = randomName();
  const vUnwrap = randomName();
  const vData   = randomName();
  const vKeyW   = randomName();
  const vIvW    = randomName();
  const vDec    = randomName();

  // Runtime decoder (tanpa NATO)
  const layerRuntime = `
  const __L__ = {
    bin: { dec: s => Buffer.from(s.split('.').map(b=>parseInt(b,2))).toString() },
    hex: { dec: s => Buffer.from(s,'hex').toString() },
    oct: { dec: s => Buffer.from(s.split('-').map(v=>parseInt(v,8))).toString() }
  };
  function ${vUnwrap}(txt, order) {
    for (let i = order.length - 1; i >= 0; i--) {
      txt = __L__[order[i]].dec(txt);
    }
    return txt;
  }`;

  const innerStub = `(function(){
    const ${vCrypto} = require("crypto");
    ${layerRuntime}
    const ${vOrderP} = ${JSON.stringify(orderPayload)};
    const ${vOrderK} = ${JSON.stringify(orderKeyMat)};
    const ${vData} = ${JSON.stringify(wrappedPayload)};
    const ${vKeyW} = ${JSON.stringify(wrappedKey)};
    const ${vIvW} = ${JSON.stringify(wrappedIv)};
    const __payload_b64 = ${vUnwrap}(${vData}, ${vOrderP});
    const __key_b64 = ${vUnwrap}(${vKeyW}, ${vOrderK});
    const __iv_b64 = ${vUnwrap}(${vIvW}, ${vOrderK});
    const __key = Buffer.from(__key_b64, "base64");
    const __iv = Buffer.from(__iv_b64, "base64");
    const ${vDec} = ${vCrypto}.createDecipheriv("aes-256-cbc", __key, __iv);
    let __o = ${vDec}.update(__payload_b64, "base64", "utf8");
    __o += ${vDec}.final("utf8");
    eval(__o);
  })();`;

  // ====== Outer layer ======
  const outerKey = crypto.randomBytes(32);
  const outerIv  = crypto.randomBytes(16);
  const innerEncB64 = aesEncryptUtf8ToB64(innerStub, outerKey, outerIv);

  const orderOuter = pickLayerOrder();
  const wrappedInnerEnc = applyLayersEncode(innerEncB64, orderOuter);

  // ====== Header ======
  const now = new Date();
  const jakarta = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "long" }).format(now);
  const utc = now.toUTCString();

  const header = `/* Encrypted Coded By @Zerobyte
Waktu Asia/Jakarta : ${jakarta}
Waktu UTC : ${utc}
░░░░▄▄▄▄▀▀▀▀▀▀▀▀▄▄▄▄▄▄
░░░░█░░░░▒▒▒▒▒▒▒▒▒▒▒▒░░▀▀▄
░░░█░░░▒▒▒▒▒▒░░░░░░░░▒▒▒░░█
░░█░░░░░░▄██▀▄▄░░░░░▄▄▄░░░█
░▀▒▄▄▄▒░█▀▀▀▀▄▄█░░░██▄▄█░░░█
█▒█▒▄░▀▄▄▄▀░░░░░░░░█░░░▒▒▒▒▒█
█▒█░█▀▄▄░░░░░█▀░░░░▀▄░░▄▀▀▀▄▒█
░█▀▄░█▄░█▀▄▄░▀░▀▀░▄▄▀░░░░█░░█
░░█░░▀▄▀█▄▄░█▀▀▀▄▄▄▄▀▀█▀██░█
░░░█░░██░░▀█▄▄▄█▄▄█▄████░█
░░░░█░░░▀▀▄░█░░░█░███████░█
░░░░░▀▄░░░▀▀▄▄▄█▄█▄█▄█▄▀░░█
░░░░░░░▀▄▄░▒▒▒▒░░░░░░░░░░█
░░░░░░░░░░▀▀▄▄░▒▒▒▒▒▒▒▒▒▒░█
░░░░░░░░░░░░░░▀▄▄▄▄▄░░░░░█
*/\n`;

  const headerHash = crypto.createHash("sha256").update(header).digest("hex");

  // ====== Outer stub ======
  const vC   = randomName();
  const vK   = randomName();
  const vV   = randomName();
  const vEnc = randomName();
  const vD   = randomName();
  const vOrd = randomName();
  const vUn  = randomName();

  const outerLayerRuntime = `
  const __L2__ = {
    bin: { dec: s => Buffer.from(s.split('.').map(b=>parseInt(b,2))).toString() },
    hex: { dec: s => Buffer.from(s,'hex').toString() },
    oct: { dec: s => Buffer.from(s.split('-').map(v=>parseInt(v,8))).toString() }
  };
  function ${vUn}(txt, order) {
    for (let i = order.length - 1; i >= 0; i--) {
      txt = __L2__[order[i]].dec(txt);
    }
    return txt;
  }`;

  let outerStub = `
    ${outerLayerRuntime}
    const ${vEnc} = ${JSON.stringify(wrappedInnerEnc)};
    const ${vOrd} = ${JSON.stringify(orderOuter)};
    const ${vC} = require("crypto");
    const ${vK} = Buffer.from("${outerKey.toString('base64')}", "base64");
    const ${vV} = Buffer.from("${outerIv.toString('base64')}", "base64");
    const __inner_b64 = ${vUn}(${vEnc}, ${vOrd});
    const ${vD} = ${vC}.createDecipheriv("aes-256-cbc", ${vK}, ${vV});
    let __s = ${vD}.update(__inner_b64, "base64", "utf8");
    __s += ${vD}.final("utf8");
    (function(){
    const fs = require("fs"), crypto = require("crypto");
    const __content = fs.readFileSync(__filename, "utf8");
    const __head = __content.split("*/")[0] + "*/\\n";
    const __hash = crypto.createHash("sha256").update(__head).digest("hex");
    if (__hash !== "${headerHash}") {
      console.error("❌ Header hilang/diubah!\\n❌ Jangan Ubah Credit!");
      process.exit(1);
    }
    eval(__s);
  })();`;

  // Minify
  try {
    const min = await minify(outerStub, { compress: true, mangle: true, toplevel: true });
    if (min.code) outerStub = min.code;
  } catch (e) {
    console.warn("⚠️ Minify gagal, pakai outer stub asli");
  }

  const finalCode = header + addNoisyComments(outerStub, 0.45);

  const parsed = path.parse(inputFile);
  const outputFile = path.join(parsed.dir, `${parsed.name}_enc${parsed.ext}`);
  fs.writeFileSync(outputFile, finalCode);

  const origSize = Buffer.byteLength(original, 'utf8');
  const outSize  = Buffer.byteLength(finalCode, 'utf8');

  console.log('\n📊 STATISTIK OBFUSCATION');
  console.log('═'.repeat(40));
  console.log(`📁 Input       : ${inputFile}`);
  console.log(`📁 Output      : ${outputFile}`);
  console.log(`📏 Ukuran asli : ${origSize} bytes`);
  console.log(`📏 Ukuran baru : ${outSize} bytes`);
  console.log(`📈 Perubahan   : ${outSize >= origSize ? '+' : ''}${outSize - origSize} bytes`);
  console.log(`🔑 Password    : ${password}`);
  console.log('🛡️  Proteksi   : AES-256 (double) + Multi-Encoder (bin/hex/oct) + Minify + Noise + Anti-Tamper');
  console.log('✅ Obfuscation selesai.');
}

/* =========================
   CLI
   ========================= */
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node obfus_no_nato.js <input.js> [password]');
    process.exit(1);
  }
  const file = args[0];
  const password = args[1] || "0x1bc6e7d2e025f57ff79917f5e72561327b751105";
  obfuscate(file, password);
}

module.exports = { obfuscate };
