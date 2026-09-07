'use strict';
/**
 * 배포된 패치본을 읽기 전용으로 재검증한다. 상태를 바꾸는 트랜잭션을 보내지 않고,
 * 개인키도 필요 없다.
 *
 *   node scripts/verify-deployment.js
 */
const { ethers } = require('ethers');
const artifacts = require('../artifacts/contracts.json');
const { CC3_TESTNET } = require('../../spike/src/config');

const NEW = {
  decoder: '0x00718d01897236C3352D5BA689BcC5c540dd9d97',
  ledger:  '0x00FcAE7CD35919d91322Ba30B42B51b4b379FF32',
  line:    '0xDcd5dfb82CA8fcDD3E628b327d5CeaCdBE69771A',
};
const OLD = {
  decoder: '0xd735522d27cF22E443F48a3a3A3Dd2de8f24F008',
  ledger:  '0xA47a20079112252afAF2d54fF1FF0268bE3826a4',
  line:    '0x0D35A7Bd0dcBBebAb54861bCe9CD04Da790B32eb',
};
const SNUSD = '0x08efcc2f3e61185d0ea7f8830b3fec9bfa2ee313';
const SUBMIT_TX = '0xeca0db64871daeab247dab6439a4905ee1e26208e00cb8c252b4e7bf1ff2461c';
const STATUS = ['NO_PROOF', 'IMPAIRED', 'RESTORED'];

(async () => {
  const p = new ethers.JsonRpcProvider(CC3_TESTNET.rpcUrl);
  const net = await p.getNetwork();
  console.log('=== 패치본 CC3 배포 온체인 재검증 (읽기 전용) ===');
  console.log('시각    :', new Date().toISOString());
  console.log('network :', CC3_TESTNET.name, '| chainId', net.chainId.toString());
  console.log('현재 블록:', await p.getBlockNumber());

  const ledger = new ethers.Contract(NEW.ledger, artifacts.EligibilityLedger.abi, p);
  const line = new ethers.Contract(NEW.line, artifacts.GatedCreditLine.abi, p);

  console.log('\n— 배포 코드 존재 확인 —');
  for (const [k, v] of Object.entries(NEW)) {
    const code = await p.getCode(v);
    console.log(`  ${k.padEnd(8)} ${v}  code ${code.length / 2 - 1} bytes`);
  }

  console.log('\n— 디코더 재사용 판정 —');
  const oldCode = await p.getCode(OLD.decoder);
  const newCode = await p.getCode(NEW.decoder);
  console.log('  구 디코더 ', OLD.decoder, oldCode.length / 2 - 1, 'bytes');
  console.log('  신 디코더 ', NEW.decoder, newCode.length / 2 - 1, 'bytes');
  console.log('  런타임 코드 동일:', oldCode === newCode ? '예 — 디코더는 변경 없음, 구 배포 재사용 가능' : '아니오');
  console.log('  ledger.DECODER() =', await ledger.DECODER());
  console.log('  ledger.VERIFIER() =', await ledger.VERIFIER());
  console.log('  line.LEDGER()     =', await line.LEDGER());

  console.log('\n— 실제 증명 입력 결과 —');
  const st = Number(await ledger.statusOf(SNUSD));
  console.log('  statusOf(sNUSD)   =', STATUS[st], `(${st})`);
  console.log('  impairedSince     =', (await ledger.impairedSince(SNUSD)).toString(), '(소스 블록)');
  console.log('  isCreditGated     =', await ledger.isCreditGated(SNUSD));
  console.log('  eventCount        =', (await ledger.eventCount()).toString());
  const ev = await ledger.getFunction('getEvent(uint256)')(0);
  console.log(`  event 0: asset ${ev.asset} impairment=${ev.impairment} srcBlock ${ev.srcBlock}`);
  const le = await ledger.latestEvents(SNUSD);
  console.log('  latestEvents      =', JSON.stringify(le, (k, v) => typeof v === 'bigint' ? v.toString() : v));

  console.log('\n— 신규 여신 차단 —');
  let refused = false, msg = '';
  try {
    await line.openPosition.staticCall(SNUSD, 1n, 0n);
    msg = 'reverted 되지 않음';
  } catch (e) {
    msg = e.shortMessage ?? e.message;
    refused = /AssetImpaired/.test(e.message ?? '');
  }
  console.log('  openPosition(staticCall):', refused ? 'AssetImpaired 로 리버트 ✅' : msg);

  console.log('\n— 증명 제출 트랜잭션 —');
  const r = await p.getTransactionReceipt(SUBMIT_TX);
  console.log('  tx     ', SUBMIT_TX);
  console.log('  block  ', r.blockNumber, '| status', r.status, '| gasUsed', r.gasUsed.toString());
  console.log('  to     ', r.to, r.to.toLowerCase() === NEW.ledger.toLowerCase() ? '(= 패치본 ledger)' : '(불일치!)');

  console.log('\n— 패치 전 배포도 온체인에 그대로 남아 있는지 —');
  const oldLedger = new ethers.Contract(OLD.ledger, artifacts.EligibilityLedger.abi, p);
  console.log('  구 ledger statusOf(sNUSD) =', STATUS[Number(await oldLedger.statusOf(SNUSD))]);
  console.log('  구 ledger code            =', (await p.getCode(OLD.ledger)).length / 2 - 1, 'bytes');

  const ok = st === 1 && refused && r.status === 1;
  console.log('\nRESULT:', ok ? '✅ 패치본 배포가 실제 증명으로 IMPAIRED 상태이며 신규 여신을 차단한다' : '❌ 예상과 다름');
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
