# @dungeon-architect/generator-strategy-core

Renderer、Editor、AI provider、特定のダンジョン生成アルゴリズムに依存しない、Generator Strategyの小さな契約ライブラリ。

目的は、各生成アルゴリズムを独立したCoreとして実装し、Dungeon Architect AI本体ではStrategyを差し替えるだけで利用できるようにすること。

- 入出力はJSON互換データのみ
- Strategy ID / version / provenanceを共通化
- Registryはcomposition rootでのみ使用
- 各Algorithm Coreはこのpackage以外のUI依存を持たない
- 将来のnpm package / DLL / shared library wrapperでも同じrequest/result envelopeを維持する

詳細: `docs/generator-algorithms/CORE_ARCHITECTURE.md`
