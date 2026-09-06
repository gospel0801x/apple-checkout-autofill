# 表单秒填 Autofill Kit

油猴（Tampermonkey）用户脚本：在 Apple 官网结算流程中自动填充收货/联系信息，打开页面即填好，主打一个"快"。

- 仅在 `*.apple.com` / `*.apple.com.cn` 网站运行，其他网站完全不注入
- 兼容 React/Angular 等框架页面（原生 setter + 事件派发）
- 配置保存在浏览器本地（Tampermonkey 私有存储），不上传、不共享
- 只填充表单字段，**不会**点击任何验证、提交、支付按钮，最终下单由本人确认

## 安装

1. Chrome 安装 [Tampermonkey](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. `chrome://extensions` → 打开右上角「**开发者模式**」
3. 篡改猴卡片「详情」→ 打开「**允许运行用户脚本**」

   ⚠️ 第 2、3 步缺一不可，否则脚本不运行且无任何报错（Chrome 138+ 的新要求）

4. Tampermonkey 图标 → 添加新脚本 → 粘贴 `autofill.user.js` 全部内容 → 保存

## 使用

1. 打开 Apple 结算页，右下角出现「表单秒填」面板
2. 「抓取」→ 页面字段清单生成 JSON（同时复制到剪贴板）
3. 给每条加 `"value": "你的信息"` → 「保存配置」
4. 开启「自动」→ 刷新页面即自动填好，之后每次进入秒填
5. 也可以直接修改脚本头部 `PROFILE` 常量，常见字段（姓名/手机/邮箱/地址/省市区，中英文）会自动识别

快捷键：⌥/Alt+F 填充 · Alt+C 抓取 · Alt+E 开关自动 · Alt+H 显隐面板

## 目录

```
autofill.user.js          主脚本（Tampermonkey）
autofill-extension/       不依赖 Tampermonkey 的独立扩展版（加载未打包扩展方式安装）
```

## 隐私与安全

- 所有配置数据仅存于本机浏览器
- 脚本仓库内不含任何真实个人信息（PROFILE 为占位示例）
- 请遵守网站服务条款，仅在个人下单场景合理使用；提交前请人工核对信息

## License

仅供个人学习与个人使用。
