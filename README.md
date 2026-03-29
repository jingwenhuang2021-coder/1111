# 项目名称

根据 Playbooks & Scripts 双层框架构建的自动化项目。

## 快速开始

### 1. 项目结构

```
├── CLAUDE.md           # 框架说明文档（必读）
├── playbooks/          # 工作流程（协调层）
├── scripts/            # 执行脚本（执行层）
├── src/                # 源代码
├── tests/              # 测试文件
└── .tmp/               # 临时文件
```

### 2. 查看可用的 Playbook

```bash
ls -la playbooks/
```

### 3. 执行 Playbook

根据需要执行对应的 Playbook，例如：

```bash
# 查看 Playbook 内容
cat playbooks/[playbook-name].md

# 按照步骤执行对应的脚本
bash scripts/[script-name].sh
```

## 核心概念

- **Playbook**：描述"应当发生什么"的流程编排文档
- **Script**：确定性执行脚本，单一职责
- **判断标准**：预定义的分叉决策逻辑

## 开发指南

### 新建 Playbook

1. 在 `playbooks/` 目录创建 `[名称].md` 文件
2. 遵循五章节模板（目的 | 前提条件 | 步骤 | 判断标准 | 验证）
3. 在 `playbooks/README.md` 中添加链接

### 新建 Script

1. 在 `scripts/` 目录创建脚本文件
2. 遵循头部注释规范
3. 确保脚本可单独运行
4. 在 `scripts/README.md` 中添加说明

## 更新日志

- [2026-03-29] 项目初始化完成

---

详见 [CLAUDE.md](./CLAUDE.md) 了解完整的框架说明。
