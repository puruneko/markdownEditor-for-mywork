import { mergeConfig } from 'vite'
import baseConfig from './vite.config'

/**
 * ドキュメント用サンプルデータ生成専用の設定。
 * 通常の単体テスト（vite.config.ts の test.include）には tools/ を含めないため、
 * 生成スクリプトはこの設定で明示的に実行する。
 *   npm run gen:samples
 *
 * mergeConfig は配列を連結するため、include だけは連結後に差し替える。
 */
const config = mergeConfig(baseConfig, {})
config.test = { ...config.test, include: ['tools/**/*.ts'] }

export default config
