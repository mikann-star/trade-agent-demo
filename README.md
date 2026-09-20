# 交易 Agent

一个用于产品演示的中文多智能体交易业务工作台。交易主理人会根据问题调度日常运营、商品运营、招商、营销活动和项目管理五个专家 Agent，并在界面中实时展示工具调用和生成结果。

## 能力

- 浏览器内模拟 manager-style 多 Agent 调度
- 确定性的流式回答与执行事件
- 内置确定性交易业务演示数据
- KPI 表格、诊断报告、项目计划和 CSV 导出
- 黑白线框三栏工作台与移动端抽屉
- GitHub Pages 静态部署，无需登录或后端服务

## 本地运行

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。演示不需要 API 密钥，刷新页面后会清空当前对话。

## 验证

```bash
npm test
npx tsc --noEmit
```

推送到 `main` 分支后，GitHub Actions 会自动构建并发布 GitHub Pages。

所有业务数据均为虚构演示数据，应用不会连接、读取或修改真实业务系统。
