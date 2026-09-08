# @packet-schema/presets

[PSDL 0.5](https://github.com/Packet-Schema/core/blob/main/spec/psdl-0.5.md) で記述した、ネットワークプロトコルの組み込みプリセット **184 種**。

```bash
npm install @packet-schema/presets
```

```ts
import { PRESETS } from "@packet-schema/presets";

PRESETS["ipv4"]; // → PSDL 0.5 の Packet オブジェクト
Object.keys(PRESETS).length; // → 184
```

エクスポートは `PRESETS` の 1 つだけ。キーは **ファイル名の stem**（`presets/ipv4.psdl.yaml` → `"ipv4"`）で、パケットの `name`（`"IPv4 Header"`）とは別物。

---

## 収録範囲

`presets/*.psdl.yaml` に 1 プロトコル 1 ファイル。全件が `version: "0.5"` を宣言し、`meta.family` / `meta.tags` を持つ（欠落 0）。

L2 から L7、暗号化トランスポート、ルーティング / 管理プロトコルまで。ファミリ数 88。代表例:

| 領域            | 例                                                        |
| --------------- | --------------------------------------------------------- |
| L2 / L3         | ethernet, arp, ipv4, ipv6, icmp, icmpv6                   |
| トランスポート  | tcp, udp, sctp, quic, dccp                                |
| 名前解決 / 時刻 | dns, mdns, ntp, ptp                                       |
| ルーティング    | bgpUpdateFull, ospf, isisLsp, rip, pgm                    |
| トンネル        | gre, vxlan, geneve, l2tp, capwap, amt                     |
| セキュリティ    | tlsHandshake, ipsecEsp, ikev2, ocspRequest, kerberosAsReq |
| 管理 / 計測     | snmpV2c, snmpv3, ipfix, sflow, bfd, rtcpSdes              |

一覧は `ls presets/` が最短。

---

## プリセットを追加する

### 1. ファイルを置く

`presets/<key>.psdl.yaml`。`<key>` がそのまま `PRESETS` のキーになる。

先頭 2 行は既存ファイルに揃える:

```yaml
# yaml-language-server: $schema=../node_modules/@packet-schema/core/schemas/psdl-0.5.yaml
version: "0.5"
name: UDP Header
rowBits: 32
byteOrder: BE
description: UDP header (RFC 768) — fixed 8 bytes.
meta:
  family: udp
  tags: [transport, addressing, data-transfer]
body:
  - id: srcPort
    name: Source Port
    type: { kind: int, bits: 16 }
    ...
```

1 行目の pragma を書いておくとエディタが core のスキーマで補完・検証してくれる。

書き方の正典は [`core/spec/psdl-0.5.md`](https://github.com/Packet-Schema/core/blob/main/spec/psdl-0.5.md)。ただし手を動かすなら **既存の実ファイルを読むのが早い** — `presets/udp.psdl.yaml`（最小）、`presets/ipv4.psdl.yaml`（bounded + オプション）、`presets/bgpUpdateFull.psdl.yaml`（TLV + ネスト）あたり。

### 2. 語彙を登録する

`meta.tags` / `meta.family` の値は `scripts/taxonomy.ts` に登録されていないと通らない。PSDL は語彙を開いたままにしているが、カタログの一貫性のためここで閉じている。

タグは 3 軸:

| 軸            | 個数      | 例                                                     |
| ------------- | --------- | ------------------------------------------------------ |
| **layer**     | 必ず 1 つ | `link`, `internet`, `transport`, `application`         |
| **substrate** | 任意      | `tunnel`, `encrypted`                                  |
| **function**  | 1〜3 個   | `addressing`, `routing`, `data-transfer`, `management` |

### 3. ゲートを通す

```bash
npm run check
```

4 段を順に走らせる。落ちた段で止まるので、上から潰す:

| 段                | スクリプト     | 見るもの                                                                                                                                                                       |
| ----------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `check:schema`    | `check.ts`     | JSON Schema。`kind` でノードを判別して、そのノード自身の形だけを検証するので、`oneOf` の全分岐エラーに埋もれない                                                               |
| `check:semantic`  | `semcheck.ts`  | core の `parsePsdl`（§11.1 バリデータ）。**スキーマでは取れないもの** — 未宣言の ref、前方参照・順序違反、peek の位置、checksum 幅、値辞書の規則                               |
| `check:taxonomy`  | `taxcheck.ts`  | 上の語彙登録と「layer タグはちょうど 1 つ」                                                                                                                                    |
| `check:normalize` | `normcheck.ts` | core の `normalize()` を **semantic ビュー**で実行。encrypted スコープの過剰消費（plaintext bits > wireBits）や bounded の過剰読み出しなど、**レイアウト時にしか出ない**エラー |

個別に走らせるなら `npm run check:semantic` のように。特定ファイルだけなら `npx tsx scripts/semcheck.ts presets/foo.psdl.yaml`。

### 4. 生成物を作る

```bash
npm run build
```

`scripts/build.ts` が YAML を読んで `src/presets.generated.ts` を生成し、`tsc` を通す。この生成ファイルは **gitignore されている** ので、clone 直後は存在しない。`npm run build:presets` を先に走らせること。

---

## 開発

```bash
npm ci          # @packet-schema/core を registry から取る
npm run check   # 4 段ゲート
npm run build   # 生成 + tsc
npm run typecheck
```

core への依存は registry 版（`^0.1.1`）。ローカルの core を試したいときは `npm link` を使う。

CI（`.github/workflows/ci.yml`）は Node 20 / 22 で同じ 3 コマンドを走らせるだけ。

---

## リリース

タグを打つと CI が publish する。

```bash
npm version patch      # package.json 更新 + コミット + vX.Y.Z タグ
git push --follow-tags
```

`release.yml` がタグと `package.json` の一致を検証し、`prepublishOnly`（4 段ゲート + build）を通してから `npm publish` する。認証は npm Trusted Publishing (OIDC) なので `NPM_TOKEN` は無い。provenance 付きで公開されるので、どのコミット・どの workflow run が publish したかがレジストリ上で検証できる。

**core を先に publish すること。** presets は core の公開版に依存しているので、core の新機能を使うプリセットを入れたら core → presets の順にタグを打つ。

---

## 関連

- [core](https://github.com/Packet-Schema/core) — PSDL の型・仕様・バリデータ
- [visualizer](https://github.com/Packet-Schema/visualizer) — これらのプリセットを描画するビューア

## ライセンス

MIT

プリセットは各 RFC の仕様を記述したもので、このライセンスは **その PSDL 記述**（本リポジトリの成果物）に対するもの。
