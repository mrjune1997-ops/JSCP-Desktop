/**
 * 单一版本源：所有界面展示、安装包文件名、关于信息均从此处读取。
 *
 * 版本递增规则（务必遵守）：
 *   首版                v1.0.0
 *   小功能补充 / 修补   第三位 +1   → v1.0.1、v1.0.2 …
 *   大板块 / 新模块     第二位 +1   → v1.1.0、v1.2.0 …（第三位归零）
 *
 * 修改版本只需改此文件 + package.json 的 version，两处必须保持一致。
 */
export const APP_NAME = 'JSCP'
export const APP_VERSION = '1.0.1'
export const APP_VERSION_TAG = `v${APP_VERSION}`

/** 底部署名信息 */
export const AUTHOR = {
  name: '潘俊杰 Jerry',
  contact: '1172972274',
  label: '免费试用'
} as const
