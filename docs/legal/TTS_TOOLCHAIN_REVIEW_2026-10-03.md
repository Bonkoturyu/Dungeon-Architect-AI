# 提出動画のTTS制作ツール確認 — 2026-10-03

## 結論・承認状態

- 対象は既存の150秒MP4用のオフライン英語ナレーション制作。ブラウザruntime、ホストされたAPI、モデル／ツールの再配布への承認ではない。
- 本書は技術・来歴のレビュー記録。`PROD-DEP-TTS-001` は **Approved（既存のオフライン動画制作用途限定）**。後続のPyTorch照合で、確認時点のインストール済みpayloadと公式archiveの同一性を確認し、未確認だった来歴ゲートを解消した。Kokoro導入・音声選択・動画制作・完成動画確認の既存承認に、今回の技術レビューを補完する。過去のインストール／利用前に本レビューが存在したと遡って記録しない。
- 公開・提出は延期中。既存動画の差替えを必須とする証拠は見つかっていないが、配布物の来歴上の注意と未承認の公開範囲を下記に明記する。AI_USAGEのRecorded、動画内容への了承、依存関係のApprovedは別の事実。
- この確認のために新規インストール、再合成、動画変更、有料API利用、外部公開、ソフトウェア／モデルのアップロードは行っていない。

## 実際の利用・配布境界

`kokoro 0.9.4` のKModel/KPipelineをCPUで実行し、Kokoro-82M v1.0、American English `af_heart`、speed `0.9` を使用。台本を24 kHz mono PCM16へ合成し、ピークを約−1.5 dBFSに正規化して動画編集に使用した。既存スクリプトはローカルモデル・voice・configを明示し、Hugging Face／Transformersのoffline設定を使用する。

配布候補は生成したナレーションを含む `DAI_Demo_Review_EN_2026-10-03.mp4` のみ。モデル重み、voice埋め込み、Python環境、eSpeak NG、libsndfile、wheel、辞書、ライセンスされたソフトウェアのコードはMP4やブラウザ本体に同梱していない。MP4 SHA-256は `3e3516090cea0c58c9d3da02ee9b1e888a515fd0bfcb5543cafc745ff89418f8`。

インストール済みであることは、その全モジュールが当該台本の合成中に実行された証拠とはしない。特にphonemizer/eSpeakのfallback発火を個別に記録していないため、未使用として除外せず環境全体を台帳化した。

## 正確な来歴

機械可読の [93パッケージ全件記録](evidence/TTS_TOOLCHAIN_2026-10-03.json) に以下を保存した。

- インストール済みMETADATAのname/versionとSHA-256、ライセンス宣言・分類、同梱LICENSE/COPYING/NOTICEのパスとSHA-256
- 既存pip取得計画の公式wheel URLとarchive SHA-256を、インストール済みname/versionへ厳密一致で対応付け
- `en_core_web_sm` はインストール済みdirect_urlの公式ExplosionリリースURL・SHA-256
- pip 25.0.1は環境作成時のbootstrap。追加調査で基底Python 3.12.14のensurepip同梱wheelが見つかり、実インストールpayloadと照合した。外部取得URLを推測せず、基底環境由来として区別する
- 取得計画のhashだけでは実インストール物との一致を証明しない。追加確認として、記録した公式URLからarchiveを再取得してSHA-256を検査し、インストール済みpayloadと直接照合した。初回は90 wheelとdocopt sdistの計91パッケージが一致し、torchだけHTTP 403で未照合だった。後続の同一URLへの通常取得はHTTP 200となり、torchの12,395ファイルも一致。現在は91 wheel＋docopt sdistの計92パッケージを照合済み。pip bootstrapは基底Pythonの既存ensurepip wheelと一致
- wheelのRECORDはインストーラが書き換えるため照合対象外。num2wordsの実行スクリプトはshebangだけの置換を区別し、本文一致。docoptは配布sdist内のdocopt.pyとLICENSE-MITを実ファイルに直接照合し、build生成dist-infoとの同一性は主張しない。初回バッチのarchiveは検査後に削除し、後続のtorch archiveは一時保存したが後の環境初期化で参照できなくなった。再インストールはしていない

Kokoroモデル／voice／configは実ファイルをハッシュしたうえで、公式リポジトリの確認日revision `f3ff3571791e39611d31c381e3a41a3af07b4987` のLFSハッシュ（configは取得した小さい実体）と照合した。これは**確認日に一致した固定revision**であり、保存されていない当初ダウンロード時revisionを復元したとの主張ではない。

| 対象 | SHA-256 | 固定参照 |
|---|---|---|
| Kokoro-82M v1.0 | `496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4` | [model](https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/kokoro-v1_0.pth) |
| af_heart.pt | `0ab5709b8ffab19bfd849cd11d98f75b60af7733253ad0d67b12382a102cb4ff` | [voice](https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/voices/af_heart.pt) |
| config.json | `5abb01e2403b072bf03d04fde160443e209d7a0dad49a423be15196b9b43c17f` | [config](https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/config.json) |

## 主要コンポーネントと義務の区別

| 対象・版 | 確認したライセンス／根拠 | 制作用途・再配布時の扱い |
|---|---|---|
| kokoro 0.9.4 / misaki 0.9.4 | インストール済みLICENSEとMETADATAはApache-2.0。公式wheel URL/hashは全件記録 | ソフトウェアを配布する場合はApache本文・該当するNOTICE・変更表示を保持。今回は配布しない |
| Kokoro-82M v1.0 / af_heart | [固定モデルカード](https://huggingface.co/hexgrad/Kokoro-82M/blob/f3ff3571791e39611d31c381e3a41a3af07b4987/README.md)のApache-2.0表記と公式配布元。voice実体は上記照合 | 重み／埋め込みの再配布は承認対象外。モデルのライセンス名を生成音声のCC0宣言へ読み替えない |
| torch 2.14.1+cpu | 配布METADATAのApache-2.0、LLVM exception、BSD-2/3-Clause、BSL-1.0、MITの複合表記 | PyTorch公式CPU wheelと実インストール12,395ファイルの同一性を後続検証で確認。単に「BSDのみ」と縮約しない。再配布時は同梱各成分の条件を再評価 |
| transformers 4.57.6 | Apache-2.0、インストール済みライセンス | ソフトウェアの再配布なし |
| spaCy 3.8.16 / en_core_web_sm 3.8.0 | MIT、インストール済みライセンス。言語モデルは[公式release](https://github.com/explosion/spacy-models/releases/tag/en_core_web_sm-3.8.0) | コード／言語モデルを再配布する場合はcopyright・license保持 |
| phonemizer-fork 3.3.2 | 同梱LICENSEとMETADATAでGPL-3.0-or-later | 生成結果とソフトウェア配布を区別。ソフトウェア再配布を始める場合は対応ソース等を別途確認 |
| num2words 0.5.14 | ソースヘッダでLGPL-2.1-or-later、METADATAはLGPL | 同上。ライブラリの再配布・リンク条件をMP4に機械的に転用しない |
| espeakng-loader 0.2.4 / eSpeak NG 1.52.0 | loader本体のMIT確認とwheelの注意は次節。付属eSpeak NGの[1.52.0公式README](https://github.com/espeak-ng/espeak-ng/blob/1.52.0/README.md)はGPLv3以降 | 付属libespeakの実versionも1.52.0。loader本体と付属GPLライブラリを一括MITと扱わない |
| SoundFile 0.14.0 / libsndfile 1.2.2 | SoundFileの同梱LICENSEはBSD-3-Clause、付属libsndfileのCOPYINGと1.2.2ソースヘッダはLGPL-2.1-or-later。実library versionは1.2.2 | Pythonラッパーと付属バイナリのライセンスを区別。音声を書き出すことをlibrary再配布と扱わない |
| NumPy 2.5.3 | 配布METADATAはBSD-3-Clause、0BSD、MIT、Zlib、CC0-1.0の複合表記 | 同梱部分も含む条件。NumPy生成配列や音声そのもののCC0指定ではない |
| その他の推移依存・環境ツール | 93件の全件記録。MIT/BSD/Apache系のほかcertifiのMPL-2.0、tqdmのMPL-2.0 AND MIT、regexのApache-2.0 AND CNRI-Python、typing_extensionsのPSF-2.0等 | インストール済み環境を配布しない。UNKNOWNのaddict 2.4.0は同梱LICENSEと[公式版LICENSE](https://raw.githubusercontent.com/mewwts/addict/v2.4.0/LICENSE)からMITと確認 |

[Apache-2.0 §4](https://www.apache.org/licenses/LICENSE-2.0)はWork／派生物の再配布条件。[GPLv3 §2](https://www.gnu.org/licenses/gpl-3.0.html)は出力の内容がcovered workを構成するときに限って出力も対象になる旨を定める。ツールを使用したという理由だけでMP4をGPLと断定しない。逆に、AI出力の権利・他者権利非侵害が一律保証されるとも述べない。

## espeakng-loaderの記録不備の解決と残る判断

1. espeakng-loader 0.2.4のインストール済みwheelにはlicense declaration／license fileがなく、[release commit](https://github.com/thewh1teagle/espeakng-loader/tree/146599e29be31bf17d99f0bcb7dbb2f92aef3d95)にもroot LICENSEがない。ただしその直接の後続[commit 0ddc87a](https://github.com/thewh1teagle/espeakng-loader/commit/0ddc87adf77e5850d7eeb542ac8a87d421b64daa)はMIT LICENSEの追加だけでコード変更がない。インストール済み `__init__.py` は両revisionとbyte一致し、SHA-256は `3900f0b174feebccb8991fd6f3888f037c7bfa23d9a3bdec480e894f75b03f3f`。
2. よって「インストール済みloaderソースは、MITで公開されているupstreamソースと同一」と記録できる。[固定MIT本文](https://raw.githubusercontent.com/thewh1teagle/espeakng-loader/0ddc87adf77e5850d7eeb542ac8a87d421b64daa/LICENSE)を根拠にし、元wheel自体にLICENSEが付属していたとは記載しない。付属eSpeak NGは別途GPL-3.0-or-later。releaseの[固定build workflow](https://raw.githubusercontent.com/thewh1teagle/espeakng-loader/146599e29be31bf17d99f0bcb7dbb2f92aef3d95/.github/workflows/build.yml)は1.52.0を取得する。これは版の来歴を裏付けるが、バイナリの再現build一致の検査ではない。
3. 確認したKokoro package/dist-infoとモデルrepo rootに独立したNOTICEは見つからない。モデルカードには学習データのCC BYへの言及があるが、確認したvoice資料にaf_heart固有のCC BYクレジット指定は見つからない。音声出力を明示的に特定ライセンスへ指定する条項も見つからない。この観察をあらゆる第三者権利・帰属義務が存在しないという保証にはしない。
4. AGENTSの「Third-party software: explicit production review required before install/use」と「Record exact version, source, license, provenance, NOTICE/attribution duties, and intended usage」は技術レビュー・記録を求める条項であり、既に承認された同一用途について再度ownerの許可を求める条項ではない。既存のオフライン動画制作の許可を維持し、後続のPyTorch照合により公式配布物92件とbootstrap pipの同一性を確認したため、既存の用途限定でApprovedとする。同一用途のowner再承認を要求しない。公開・提出の許可は含めない。第三者ライセンスやCC0-onlyポリシーの例外承認は不要であり、行っていない。
5. ソフトウェア／モデルの再配布、ブラウザへの導入、公開投稿は別途の判断が必要。生成音声を第三者の配布済みcreative assetと同一視しない一方、CC0-onlyポリシーを勝手に変更しない。本書では音声をCC0と表示しない。

追加の版別根拠: [phonemizer-fork 3.3.2](https://pypi.org/project/phonemizer-fork/3.3.2/)、[num2words 0.5.14 header](https://raw.githubusercontent.com/savoirfairelinux/num2words/v0.5.14/num2words/__init__.py)、[SoundFile 0.14.0 LICENSE](https://github.com/bastibe/python-soundfile/blob/0.14.0/LICENSE)、[libsndfile 1.2.2 header](https://raw.githubusercontent.com/libsndfile/libsndfile/1.2.2/src/sndfile.c)、[libsndfile COPYING](https://github.com/libsndfile/libsndfile/blob/1.2.2/COPYING)。GPLv3 §2／LGPLv2.1 §0はいずれもツール出力の内容に基づく扱いを定める。

## 検証の限界

DAI-073の14項目が通っても、もとの監査スクリプトはこのPython環境を走査しないためTTS全体の承認証拠にはならない。今回の追補は新規資料のJSON構造・正確なパッケージ照合・ローカルライセンス／モデル／動画のhash・参照・秘密情報不混入の確認であり、全依存の法的保証、脆弱性監査、再現インストール、Windows正式受入の代替ではない。

## この追補で実行した確認

- 93件のname/version重複なし、92件の取得元対応、pip bootstrap 1件は基底Pythonの既存ensurepip wheelと照合
- 同梱LICENSE/COPYING/NOTICE 195ファイルの実SHA-256一致
- モデル／voice／configの公式固定revisionとの一致、loaderソース同一性、動画hashを確認
- JSON parse、文書参照、git diff --check、DAI-073 legal 14/14、DAI-074 secret/privacy audit: PASS
- 追加4資料にローカルマシン絶対パス・credential形式が含まれないことを確認。正確なwheel URLと公開モデルのhashのみ記載
- 元mainをPR #71の既存commit `fbf5179ac2c2805ca74ee9e2b29a1ed4f5af8b19` へ同一hashを検証して同期。PR #71の本文を重複変更として扱っていない。この記述は初回ローカルレビュー時点の確認で、後続PR #72のcommit／push履歴とは区別する
- runtime変更なし。全Node test・ブラウザsmoke・再インストールは今回実行していない

## PR #72追加レビューへの対応

取得計画とname/version一致だけでは不十分という指摘を受け、公式archiveと実インストールpayloadの直接照合を実施した。結果は上記とJSONの `archive_verification_summary`／各packageの `official_archive_installed_payload_verification` に保存。未照合のバイナリがあることは、生成音声の権利侵害や動画差替え必須を意味しない。技術的な同一性証拠の限界として扱い、再度の用途承認によって解消したと扱わない。

初回のtorch照合では取得成功ログ／保存wheelが見つからず、HTTP 403でPending Evidenceとした。後続検証では回避操作・別配布元・再インストールを使わず、同じ公式URLを通常取得して同一性を確認した。過去の403は応答本文・ヘッダーを保存していないため原因不明のまま扱い、恒久的な制限や一時障害だったと断定しない。

bootstrap pip追補: 基底Python 3.12.14に同梱されたpip 25.0.1 wheel（1,841,526 bytes、SHA-256 `c46efd13b6aa8279f33f2864459c8ce587ea6a1a59ee20de055868d8f7688f7f`）と実インストール437ファイルがbyte一致。RECORDの書換部分は除く。91件の公式archive直接照合とは別枠であり、外部からの取得履歴は新たに主張しない。

## PyTorch来歴ゲートの解消（同日13:27 UTC）

- 同じ[公式wheel URL](https://download-r2.pytorch.org/whl/cpu/torch-2.14.1%2Bcpu-cp312-cp312-manylinux_2_28_x86_64.whl)を通常のcurlで取得し、HTTP 200・リダイレクト0。196,253,677 bytes。
- archive SHA-256 `5a6363570c753812540a05eb82380e329469cbe668643e88111414c12627711f` は保存済み取得計画と、検証時の[公式index](https://download.pytorch.org/whl/cpu/torch/)の両方に一致。
- `2026-10-03T13:27:38.009843+00:00` の検証で、wheel payload 12,395ファイルを実インストール側とSHA-256比較し、全件一致・欠落0・差分0。directory 779件と、インストーラが書き換える `torch-2.14.1+cpu.dist-info/RECORD` はpayload比較から除外。
- インストーラ追加2,441件（主にpycache、torchrun／torchfrtrace、INSTALLER／REQUESTED）は、元archiveとのbyte一致を主張する範囲に含めない。torchのimport、インストール、動画再生成はしていない。
- 完全manifestの当時のSHA-256は `ced42e910335bf1c2533e9bc356b6e4b4c11232c94e2b2550e85094baed46ba0`。後の実行環境初期化により元wheel・完全manifest・全追加ファイル一覧は現在参照できず、実行時tool出力に保存されていた結果要約をJSONへ復元した。manifestサイズは未保存で推定しない。hashを示すことは元manifestを本repoに収録したという意味ではない。
- 結論は「検証時のインストール実体が公式配布物と一致」。歴史的なインストール成功ログの復元、過去403原因の確定、一般的な脆弱性保証、公開・提出の承認とは区別する。

本解消記録の編集時には、現mainから文書を復元して元blobとの一致を確認し、JSON構造・93件のstatus集計・torchのhash／HTTP／件数・過去の失敗記録保持・diff／秘密情報形式を検査した。上記DAI-073／074のPASSは先行レビュー時点の記録であり、実行環境初期化後の今回編集では全checkout・依存環境がないため再実行していない。今回の変更は資料4件のみでruntime差分はない。
