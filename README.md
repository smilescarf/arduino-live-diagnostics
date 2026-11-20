# Arduino Live Diagnostics · Arduino 实时报错

输入时诊断 **未保存** 的 Arduino 代码，显示错误位置，并附上常见错误的中文解释。

**公开测试版（alpha）**：[下载安装包与 ZIP](https://github.com/zgwfxy/arduino-live-diagnostics/releases)。ZIP 内含 VSIX 插件、完整源码与中文安装说明。已验证 Windows / Arduino IDE 2.3.10；其他组合请参阅兼容性说明。

## 0.4.0：编写代码辅助

0.4.1 修复 Arduino IDE 的 `Invalid argument` 修复失败问题。点击“修复建议”时，如果光标处没有建议，可从当前文档的问题列表中选择。HIGH / LOW 始终表示高 / 低电平，开关状态由接线及模块有效电平决定。

- **实时解释**：`digitalWrite(LED_PIN)` 缺参时，根据编译器及候选声明解释缺少输出电平，并标出调用位置。
- **工程补全**：输入 `servo.` 或按 Ctrl+空格，根据当前板型、已包含库和未保存代码查询真实成员；填写引脚参数时优先排序可见的引脚变量。首次索引完成后可用。
- **中文参数提示**：输入 `map(`、`digitalWrite(` 等，在括号和逗号处显示当前参数说明；可按 Ctrl+Shift+空格主动唤起。核心常用函数有中文解释，第三方库保留其真实签名和原文。
- **修复预览**：在错误处按 Ctrl+.，或点击底部“修复建议”，选择建议后先查看差异，再点“应用修改”。缺参可明确选择 HIGH 或 LOW；编译器提供的分号/拼写等修复也走预览。不会自动决定你的控制逻辑，不保存或上传。
- **插入片段**：点击底部“插入片段”，把 millis 定时、按键消抖或模拟读取合并到当前 setup/loop；重复插入自动避开名称冲突。条件编译、提前 return 和不完整结构会提示手工处理。合并结果同样先预览。
- **学习建议**：以信息级提示解释 loop 中较长的字面量 delay、字面量整数除法、中断回调内延时/串口。属于可能的设计问题；可关闭 `arduinoLive.learningSuggestions`。未初始化和数组越界仍由编译器判断；额外学习扫描不会分析条件编译分支，不承诺发现全部运行时问题。

## 课件实验与模板

现有 **42 个独立实验模板**：LED/SOS、按键消抖、流水灯、中断、定时器、PWM/音阶、ADC/感光灯、WS2812、数码管/TM1637、ST7789、超声波/舵机/雷达、触摸继电器、Wi-Fi/TCP/网页/ESP-NOW、BLE/GATT/快捷键盘，以及光电/数字霍尔等补充实验。

**使用方法：** 底部实时监测面板点击 **实验模板**（或 Ctrl+Shift+P → **Arduino Live: 打开实验模板**）→ 搜索课次/器件/名称 → 选择存放目录。插件创建同名工程和中文 `README.md`，包含接线、所需库、参数、预期现象、排错及课件页码；已有工程不会覆盖。提示中的“查看实验说明”可直接阅读指南。实时诊断不需要保存；让硬件运行仍需上传。

课件实验针对 **ESP32-S3 / Arduino-ESP32 3.x**；若当前板型不匹配，会说明所需板型。原有 5 个通用模板支持 Uno 和 ESP32-S3，按实际板卡调整引脚。安装库管理器中的 FastLED、TM1637、LovyanGFX、ESP32Servo 即可完成相应第三方库实验；其余模板使用核心自带 API / 库。网络凭据为占位符，需要自行填写。

完整清单与课件内容差异见 `docs/EXPERIMENTS.md`，后续建议见 `docs/PROJECT-ROADMAP.md`。原 PPTX 留在本地，不随插件或源码打包。

### 实时错误列表

底部面板按“级别 / 错误代码 / 中文说明 / 文件 / 行 / 列”分列，支持错误、警告筛选和关键词搜索。点击问题会跳转并显示附近代码，原始诊断可展开查看。编辑后旧结果会标记为待更新；不需要保存。左侧栏保留精简列表。

缺少分号时会依据编译器的插入建议把红线标在语句末尾；明确缺条件的 `if` 和具有完整循环头但误拼成 `fo` 的位置，会直接标记相关关键字。详情保留编译器最初位置。

- **函数与库**：搜索 `digitalWrite`、`pinMode`、`map`、中断、LEDC、定时器等，查看中文说明与调用示例。编辑器输入函数名或按 Ctrl+空格，也可选择带参数占位符的入门补全；ESP32 专用 API 随板型显示，并标注核心版本。
- **当前库**：根据当前文档的 `#include`，匹配本机已安装库的真实头文件，浏览公开声明、源文件行号及库自带示例。示例以副本打开，不修改已安装库。头文件浏览不等于完整 C++ 语义分析：宏、条件编译、继承和重载请结合 IDE 原生补全/转到定义；第三方库原始文档保留原文。

当前诊断直接使用编辑器的源文件内容，编译数据库来自 Arduino CLI；通过同目录的虚拟 C++ 文件与原文件逐行对应，不向用户源码插入预处理行，也不再依赖 Arduino Language Server 的预处理副本映射。未保存的 `#include` 也传给 CLI 获取库参数；修改包含库时会重新准备编译参数。只有代码编辑时直接同步 clangd，旧版本诊断会被丢弃。

基础 Arduino 函数的前置声明写入独立缓存头文件。自定义类型、默认参数或跨标签页全局变量等复杂用法应写显式声明/头文件；此模式尚不能完整替代 Arduino 的全部自动原型处理。首次索引与切换库仍需等待。

## 现在怎么用

**0.1.4 大面板：** 默认在窗口底部打开“实时监测 / 实时诊断”，集中显示板型、检查状态、错误和警告。点击问题行可跳到代码。点击面板标题栏的侧边栏图标，或从菜单选择“显示在左侧”，可切换到左侧；同样可以切回底部。拖动面板与代码之间的分隔线可以调大面板。位置切换不会重启检查或丢失当前诊断。

1. 重启 Arduino IDE，打开 `.ino` 工程。代码继续使用原有的 **C++ 彩色语法**。
2. 像平常一样在 IDE 顶部选择开发板。插件默认自动跟随，不用再选第二次。
3. 看窗口底部 **“实时检查”** 状态：首次“正在解析…”需要等待，“已就绪”表示已经收到诊断结果。
4. 直接修改代码，不需要保存。出现波浪线时把鼠标停上去查看错误和中文提示，修正后提示自动消失。

底部 **“实时检查”** 始终可以点击打开菜单。`.ino` 编辑器标签栏右上角也有脉冲图标，命令面板可搜索 **Arduino Live: 实时检查菜单**。菜单集中提供“开始配置 / 重新配置”“选择开发板”“使用说明”“重启实时检查”和“查看诊断日志”。

如果显示“点击配置”，点击菜单中的“开始配置 / 重新配置”。默认复用现有 Arduino IDE 工具。首次运行还会出现带“使用说明”和“开始配置”按钮的提示。

本项目通过标准 VS Code 扩展 API 接入 clangd，并从 Arduino CLI 获取当前开发板的编译参数。诊断通过 `textDocument/didChange` 增量同步触发，不需要点击保存、编译或上传。

## 初版功能

- `.ino`、`.cpp`、`.h` 等 sketch 文件的实时诊断。
- 编辑器红线和 Problems 面板中的文件、行列定位。
- 保留原始错误，为未声明名称、缺失分号、找不到头文件、类型不匹配等追加中文解释。
- 复用 Arduino IDE 2 自带的 CLI、语言服务器和 clangd。
- 配置引导、开发板选择、日志面板和服务重启。
- 选择 ESP32 / ESP32S3 等 Espressif 板型时，自动使用原生支持 Xtensa/RISC-V 的 Espressif 官方 clangd；Uno 使用原有工具。

### 已验证的板型与工具

Windows / Arduino IDE 2.3.10，使用 Arduino CLI 获取参数并直接连接 clangd 实测：

| 板型 | 诊断后端 | 未保存错误 / 修复 |
| --- | --- | --- |
| `arduino:avr:uno` | Arduino IDE 自带 clangd 14 | 通过 |
| `esp32:esp32:esp32s3`，ESP32 核心 3.3.12 | Espressif clangd 22.1.4 | 通过 |

其他已安装板型可在选择列表中搜索，但尚未逐一验证。首次索引完成后的本机单次测试中，ESP32S3 报错约 92 ms、修复清除约 96 ms；不是固定延迟承诺。

首版覆盖静态语法/语义检查。最终能否编译、链接及运行，仍需对应工具链验证。不能直接发现接线错误或所有运行时故障。

## 安装与配置

### VS Code（标准扩展入口）

1. 使用 VS Code 1.85 或更新版本，运行“Extensions: Install from VSIX...”，选择发布包。
2. 打开 Arduino sketch 所在文件夹，主文件必须与文件夹同名，例如 `LiveDemo/LiveDemo.ino`。
3. 打开命令面板，执行 **Arduino Live: 配置工具和开发板**。
4. 自动发现失败时，选择 Arduino IDE 2 安装目录，或分别指定三个可执行文件。
5. 选择已经安装核心的开发板。首次启动需要构建索引，之后输入时自动更新诊断。

无需连接开发板或上传程序。

**切换板型：** 在 Arduino IDE 中默认跟随顶部板型；切换后会重建诊断。也可从底部“实时检查”菜单选择“选择开发板”，手动指定已安装的板型。手动选择会关闭跟随；选择“跟随 IDE 顶部选择的开发板（推荐）”可恢复跟随。VS Code 中手动选板。手动模式请确认诊断板型与上传板型一致。

首次选择 ESP32 系列时，插件从 [Espressif 官方 LLVM 发布页](https://github.com/espressif/llvm-project/releases/tag/esp-22.1.4_20260825) 下载固定版本的独立 clangd（约 12–18 MB），校验预置 SHA-256 后解压到插件缓存。需要系统 `tar` 支持 `.tar.xz`（Windows 10/11 自带）。离线用户可设置 `arduinoLive.espClangdPath`。不修改 Arduino IDE 自带工具或开发板核心。

ESP32 的少量 GCC 专用代码生成参数在独立临时目录内通过 `.clangd` 配置移除；不屏蔽源码错误，也不替换目标架构或项目的编译选项。此配置仅影响静态诊断，不改变上传构建。

### Arduino IDE 2（实验兼容入口）

Arduino IDE 基于 Theia，第三方扩展兼容性需按版本验证，不保证所有 VS Code API 都可用。

1. 退出 Arduino IDE。
2. 将发布的 `.vsix` 文件复制到 `~/.arduinoIDE/plugins/`；Windows 对应 `%USERPROFILE%\.arduinoIDE\plugins\`。
3. 重新启动 IDE，打开 sketch，按 `Ctrl+Shift+P` 搜索 `Arduino Live` 命令进行配置。

移除该 `.vsix` 后重启即可卸载。安装目录依据 [Arduino IDE 高级使用文档](https://github.com/arduino/arduino-ide/blob/main/docs/advanced-usage.md#installation)，该文档以主题扩展为例；代码扩展的兼容性须单独测试。

## 亲自验证“不保存也报错”

打开 `examples/LiveDemo/LiveDemo.ino`，将 `int value = 0;` 中的 `0` 改为 `missingName`，**不要保存**。

等待索引完成后，应出现未声明标识符的诊断及中文解释。将其改回 `0`，仍然不要保存，诊断应自动消失。如果 IDE 开启了自动保存，也可以使用下面的集成测试确认诊断确实来自内存中的增量编辑。

首次索引耗时取决于电脑、开发板和依赖；不承诺每个工程的固定延迟。语言服务器可能因库依赖变化重新构建索引。

## 设置

| 设置 | 用途 |
| --- | --- |
| `arduinoLive.fqbn` | 完整板型，例如 `arduino:avr:uno`；以当前工程设置为准 |
| `arduinoLive.followIdeBoard` | 默认开启：在 Arduino IDE 中跟随顶部选择的板型 |
| `arduinoLive.viewLocation` | `bottom` 底部大面板（默认）或 `left` 左侧栏 |
| `arduinoLive.arduinoIdePath` | Arduino IDE 2 安装目录 |
| `arduinoLive.cliPath` | 自定义 Arduino CLI 路径 |
| `arduinoLive.languageServerPath` | 自定义 Arduino Language Server 路径 |
| `arduinoLive.clangdPath` | 自定义 clangd 路径 |
| `arduinoLive.espClangdPath` | 可选 Espressif clangd 路径；留空自动获取校验版本 |
| `arduinoLive.cliConfigPath` | 自定义 CLI YAML 配置，通常自动发现 IDE 的 `.arduinoIDE/arduino-cli.yaml` |
| `arduinoLive.chineseExplanations` | 启用或关闭中文解释 |
| `arduinoLive.enabled` | 当前工作区是否开启诊断 |

板型由用户明确选择，插件不会猜测实体开发板。核心必须预先通过 Arduino IDE 开发板管理器安装。更改配置会重启语言服务器。

## 开发与打包

Node.js 20.19+（开发工具要求；扩展运行时以宿主为准）。

```sh
npm install
npm test
npm run check
npm run package
```

也可使用 `pnpm install --frozen-lockfile`。安装包输出到 `releases/`。项目使用 esbuild 打包扩展运行依赖，不携带 Arduino/LLVM 二进制文件。

打包后在 VS Code 中按 F5 启动扩展开发窗口；安装/配置现有 Arduino 工具并选择板型。

### 测试

`npm test` 测试源码定位、配置发现与诊断解释。真实工具链集成测试：

```sh
npm run test:integration
```

测试需要 Arduino IDE 2 或环境变量指定 `ARDUINO_CLI_PATH`、`ARDUINO_LS_PATH`、`CLANGD_PATH`。可选 `ARDUINO_IDE_PATH`、`ARDUINO_CLI_CONFIG`、`ARDUINO_FQBN`；默认使用已安装的 `arduino:avr:uno`。

集成测试在 `.tmp/` 创建有效 sketch，通过增量 `didChange` 在内存中引入错误并修复，断言收到诊断、诊断清除、磁盘文件未改变，全程不发送 `didSave`。它验证真实语言服务器链路；宿主 UI 兼容性需要单独验证。

## 故障排查

- 状态栏提示“点击配置”：检查三个工具路径及 FQBN。
- 启动失败：运行 **Arduino Live: 查看诊断日志**，检查核心、库和 CLI 配置。
- 找不到库：确认插件复用的 CLI 配置与 Arduino IDE 的用户库目录一致。
- 重复红线：可能有多个 C/C++ 诊断扩展同时运行，按需关闭重复来源。
- 首次索引较慢：等待工具链完成初始化；ESP32 等大型核心可能耗时更长。
- `.ino` 不启动：检查主文件是否与所在文件夹同名，并打开该工程文件夹。

## GitHub 发布准备

源码包含测试、CI、MIT LICENSE 和反馈模板。GitHub Releases 提供测试安装包；扩展市场发布仍需注册实际 publisher 并验证目标系统。`arduino-live-local` 是本项目当前扩展标识，不代表官方发布者或已经上架市场。

## 路线图

- 更完整的 Arduino IDE 兼容验证与自动板型同步。
- ESP32、多个 `.ino`、中文路径等工程的诊断验证。
- 减少重复诊断与更友好的首次索引状态。
- 扩充中文规则和有依据的快速修复。

## License / 上游项目

本扩展自主代码采用 MIT。[Arduino Language Server](https://github.com/arduino/arduino-language-server) 采用其自身的 AGPL-3.0 许可证，clangd 和 Arduino CLI 同样遵循各自许可证；本仓库与 VSIX 不内嵌这些工具。ESP clangd 通过官方发行包单独下载，保留该包的许可证文件。使用时请查阅所选上游版本的许可证。

## English

Arduino Live Diagnostics connects clangd directly to live, unsaved sketch buffers using Arduino CLI compile parameters. It preserves original diagnostics, adds Chinese explanations and provides 42 annotated experiment templates. Run **Arduino Live: 配置工具和开发板** to locate Arduino IDE tools and select an installed board. Course templates target ESP32-S3 with Arduino-ESP32 3.x. Arduino IDE 2 support is experimental. No save, upload, or hardware connection is required for static diagnostics.
