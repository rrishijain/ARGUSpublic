# Third-party notices

ARGUS's original code is offered under its MIT licence. Installed packages, model weights, browser assets and managed runtimes retain their own upstream licences. This inventory records package metadata and upstream notices; it does not relicense dependencies under ARGUS's licence.

## Application and browser assets

Versions are resolved by package-lock.json. The declarations below were checked against the installed package metadata for this release.

| Component | Version | Declared licence | Upstream |
| --- | --- | --- | --- |
| Next.js | 15.5.25 | MIT | [Next.js](https://github.com/vercel/next.js) |
| React / React DOM | 19.3.0 | MIT | [React](https://github.com/facebook/react) |
| Three.js, Reflector, RoundedBoxGeometry | 0.176.0 | MIT | [Three.js](https://github.com/mrdoob/three.js) |
| Fontsource Variable Inter / Plus Jakarta Sans | 5.3.0 | OFL-1.1 | [Fontsource](https://github.com/fontsource/fontsource) |
| PDF.js | 6.3.289 | Apache-2.0 | [PDF.js](https://github.com/mozilla/pdf.js) |
| Cheerio / csv-parse / react-markdown | 1.2.0 / 7.0.2 / 10.1.0 | MIT | Installed package notices |
| esbuild | 0.28.2 | MIT | [esbuild](https://github.com/evanw/esbuild) |
| @ricky0123/vad-web | 0.0.30 | ISC | [VAD](https://github.com/ricky0123/vad) |
| Silero VAD model | v5 asset supplied by vad-web | MIT | [Silero licence](https://github.com/snakers4/silero-vad/blob/master/LICENSE) |
| ONNX Runtime Web | 1.23.2 | MIT | [ONNX Runtime](https://github.com/microsoft/onnxruntime) |
| Playwright Test (development) | 1.58.2 | Apache-2.0 | [Playwright](https://github.com/microsoft/playwright) |
| TypeScript (development) | 5.9.3 | Apache-2.0 | [TypeScript](https://github.com/microsoft/TypeScript) |

Font licence texts are retained under docs/licenses. Installation copies the VAD worklet, Silero model and ONNX Runtime Web module/WASM from npm packages into ignored public/voice-assets for local browser use. These assets are not original ARGUS code; preserve their notices when distributing a built application.

## Downloaded local speech stack

The pinned bootstrap and model artifact URLs/hashes are recorded in voice-server/bootstrap.json and voice-server/models.json. Python package versions and wheel hashes are fixed in voice-server/requirements.lock. Runtime files are downloaded during local setup and are excluded from the public source ZIP.

| Component | Pinned release | Declared licence / notice | Upstream |
| --- | --- | --- | --- |
| uv | 0.12.13 | MIT OR Apache-2.0 | [uv licence](https://github.com/astral-sh/uv#license) |
| Managed CPython | 3.12.14 | PSF-2.0 with bundled component notices | [Python licence](https://docs.python.org/3/license.html); installed Python LICENSE.txt |
| kokoro-onnx wrapper | 0.5.0 | MIT | [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) |
| Kokoro weights and voice data | v1.0 model / v1.0 voices | Model card declares Apache-2.0 | [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M); artifact URLs in models.json |
| faster-whisper | 1.2.1 | MIT | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) |
| Converted Whisper small.en weights | Revision d1d751a5f8271d482d14ca55d9e2deeebbae577f | Model card declares MIT | [Systran model card](https://huggingface.co/Systran/faster-whisper-small.en) |
| ONNX Runtime (Python) | 1.20.1 | MIT | [ONNX Runtime](https://github.com/microsoft/onnxruntime) |
| CTranslate2 | 4.6.0 | MIT | [CTranslate2](https://github.com/OpenNMT/CTranslate2) |
| NumPy | 2.2.6 | BSD; bundled numeric-library notices also apply | Installed wheel METADATA and licence files |
| FastAPI | 0.135.1 | MIT | Installed wheel METADATA and licence files |
| Uvicorn | 0.42.0 | BSD-3-Clause | Installed wheel METADATA and licence files |
| SoundFile | 0.13.1 | BSD-3-Clause; included libsndfile has LGPL-2.1 notice | Installed SoundFile licence and _soundfile_data/COPYING |
| PyAV | 15.1.0 | BSD-3-Clause for the wrapper; FFmpeg libraries have separate notices | Installed PyAV licence; [FFmpeg licensing](https://ffmpeg.org/legal.html) |
| phonemizer-fork | 3.3.2 | GPL-3.0-or-later | Installed wheel METADATA/LICENCE; [Phonemizer](https://github.com/bootphon/phonemizer) |
| eSpeak NG loaded by espeakng-loader | Loader 0.2.4; local macOS library 1.52.0 | eSpeak NG declares GPL-3.0-or-later and additional component notices; loader wheel metadata does not declare a licence | [eSpeak NG licence information](https://github.com/espeak-ng/espeak-ng#license-information) |

The complete speech dependency set also contains packages with Apache, BSD, MIT, MPL, PSF and other licence declarations. For exact installed artifacts, retain each wheel's .dist-info/METADATA, LICENSE/COPYING and bundled native-library notices. The table is not an exhaustive notice bundle for every platform wheel.

Kokoro's model card includes its own training-data attribution section; keep it with any redistributed model materials. The downloaded speech stack includes GPL/LGPL components and is not wholly MIT-licensed. This repository distributes the installer and application sources, not a prepackaged copy of that stack. Anyone packaging downloaded runtimes, native libraries or weights for others must address the applicable upstream distribution terms and notices for those exact artifacts.
