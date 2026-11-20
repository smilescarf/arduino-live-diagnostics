# Arduino Live Diagnostics v0.4.2 安装说明

这是公开测试版（alpha），提供未保存代码的实时诊断、常见错误中文说明、函数助手和 42 个实验模板。

## ZIP 内容

- `arduino-live-diagnostics-0.4.2.vsix`：插件安装包。
- `source/`：完整项目源码、实验、文档与测试。
- `SHA256SUMS.txt`：安装包 SHA-256 校验值。

## Arduino IDE 2 安装（已验证 Windows / 2.3.10）

1. 保留需要的编辑，退出 Arduino IDE。
2. 将 VSIX 复制到 `%USERPROFILE%\.arduinoIDE\plugins\`；没有目录时新建。升级时请先把同一插件的旧版 VSIX 移出该目录备份。
3. 打开 IDE 和一个 `.ino` 工程，自行判断并处理 IDE 的工作区信任提示。
4. 按平时的方式在 IDE 顶部选择已安装核心的实际开发板。
5. 看底部“实时监测”状态；首次索引需等待，显示“已就绪”后可直接编辑，不必保存或上传来触发诊断。
6. 点击“实验模板”创建实验工程；点击“函数与库”查看中文说明及本机库声明。
7. 输入函数的括号或逗号查看中文参数提示；Ctrl+空格可主动补全，Ctrl+Shift+空格可主动打开参数提示。输入对象名与点号查看库成员。
8. 把光标放在错误处按 Ctrl+.，或点击“修复建议”。先看差异，再选“应用修改”；“插入片段”也会预览合并结果，不自动保存。

若未显示底部面板，按 Ctrl+Shift+P 搜索 `Arduino Live: 打开实时监测面板`。工具未发现时运行 `Arduino Live: 配置工具和开发板` 并选择 Arduino IDE 安装位置。

## VS Code 安装

运行 `Extensions: Install from VSIX...` 选择安装包，打开 sketch 文件夹，然后运行 `Arduino Live: 配置工具和开发板`。

## 环境与依赖

- 需要 Arduino IDE 2 工具链和对应开发板核心；诊断不要求连接实体开发板。
- ESP32 首次使用会单独下载并校验 Espressif clangd，需联网；离线使用可自行设置 `arduinoLive.espClangdPath`。
- 课程模板以 ESP32-S3 / Arduino-ESP32 3.x 为目标；相应模板的 README 列出具体依赖。第三方库按需通过库管理器安装：FastLED、TM1637、LovyanGFX、ESP32Servo。
- 实时静态检查不能验证真实接线和外设效果；运行实验需要检查接线并正常编译上传。
- 中文说明覆盖常用核心 API；第三方库签名由实际安装库提供，原文可能为英文。学习建议可在设置中关闭；复杂的条件编译和提前 return 工程不会自动插入片段。

## 卸载与反馈

关闭 IDE，将该 VSIX 移出 plugins 目录，再启动 IDE 即可卸载。反馈请提供宿主版本、板型、核心/库版本、最小代码和诊断日志（先移除密码与私人信息）。

源码与更新：https://github.com/zgwfxy/arduino-live-diagnostics

自主代码 MIT；独立下载或本机已安装的工具、核心和第三方库遵循各自许可证。ZIP 不包含工具链二进制或原始课件。
