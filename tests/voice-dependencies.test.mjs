import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Windows CTranslate2 DLL discovery retains its hash-pinned pkg_resources dependency',()=>{
  const direct=fs.readFileSync('voice-server/requirements.txt','utf8'),lock=fs.readFileSync('voice-server/requirements.lock','utf8');
  // CTranslate2 v4.6.0/python/ctranslate2/__init__.py imports pkg_resources only on win32.
  // setuptools removed that module in 82.0.0, so macOS-only inference cannot catch this drift.
  if(/^ctranslate2==4\.6\.0$/m.test(direct)){
    const version=direct.match(/^setuptools==(\d+\.\d+\.\d+)$/m)?.[1];assert.ok(version,'Declare the Windows runtime compatibility pin directly, not only transitively.');
    assert.ok(Number(version.split('.')[0])<82,'CTranslate2 4.6.0 requires setuptools with pkg_resources (before 82).');
    const block=lock.match(/^setuptools==([^\n]+)\n((?:[ \t]+[^\n]*\n)+)/m);assert.ok(block,'Setuptools must remain in the verified lock.');assert.equal(block[1].replace(/\s*\\$/,'').trim(),version);assert.equal((block[2].match(/--hash=sha256:[a-f0-9]{64}/g)||[]).length,2,'Keep the verified wheel and sdist hashes.');
  }
});
