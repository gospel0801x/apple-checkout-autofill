# 表单秒填 · 本地扩展版

不依赖篡改猴（Tampermonkey）的独立 Chrome 扩展，只在 apple.com / apple.com.cn 上运行。

## 安装（一次性，约 30 秒）

1. Chrome 地址栏输入 `chrome://extensions` 回车
2. 确认右上角「开发者模式」已开启（已开启过）
3. 点左上角「加载未打包的扩展程序」
4. 选择本文件夹（`autofill-extension`）
5. 打开/刷新 Apple 结算页，右下角出现「表单秒填」面板即成功

## 使用（和油猴版完全一致）

- 「抓取」→ 生成当前页面字段清单 → 给每条补 `"value"` → 「保存配置」
- 开「自动」→ 之后进入结算页自动填
- 快捷键：⌥/Alt+F 填充 · Alt+C 抓取 · Alt+E 开关自动 · Alt+H 显隐面板
- 配置存在扩展自己的 `chrome.storage.local` 里，按域名隔离，页面脚本读不到

## 注意

- 改了 `content.js` 后需要在 `chrome://extensions` 点本扩展的「重新加载」↺
- 脚本只填字段，不会点击任何提交/支付按钮，最终下单请人工确认
- `PROFILE` 里的姓名手机是占位资料，用前改成真实资料
