# v0.3.0 验证记录

## v0.4.0 增量验证（2026-11-20）

- 43 项自动化测试通过，新增了参数索引、中文缺参解释、语义结果排序、过期结果丢弃、预览期间编辑保护、跨文件修复拒绝、片段重名与学习建议过滤。
- Uno 与 ESP32-S3 真实 clangd 集成测试通过：全程无 didSave，磁盘源码未变；验证成员补全、未保存引脚补全、真实函数签名、digitalWrite 缺参解释和可预览分号修复。
- ESP32-S3 集成测试实际包含本机 ESP32Servo 3.2.1；Uno 使用测试类核对通用 C++ 成员语义。移动头文件跨越预编译区域时需刷新会话，已加入刷新检测和回归测试。
- 定时、按键、模拟读取与重复按键片段合并为一个工程，分别通过 Uno、ESP32-S3 的完整编译。
- 本次未修改 42 个实验模板的功能，原 47 组模板编译结果继续作为历史验证；未执行外设实测。

## v0.3.0 历史记录

验证日期：2026-11-19；Windows / Arduino IDE 2.3.10。

- 35 项自动化测试通过，包含板型限制、模板生成、README 与不覆盖用户代码。
- 47 组完整编译通过：ESP32-S3 42 个模板（Arduino-ESP32 3.3.12）；Uno 5 个通用模板（AVR 1.8.8）。
- 编译库版本：FastLED 3.10.9、TM1637 1.2.0、LovyanGFX 1.3.0、ESP32Servo 3.2.1；WiFi/BLE/ESP-NOW 等使用 ESP32 核心。
- 42 份 examples 与插件模板源码一致。
- 实验板卡、外设接线和无线配对仍需实机验证；本次编译未上传或控制硬件。

复现：node --test test/*.test.js；node scripts/generate-examples.js；node scripts/validate-templates.js。工具路径可用 ARDUINO_IDE_PATH、ARDUINO_CLI_CONFIG 指定；板型可用 ARDUINO_TEST_BOARDS 指定。ARDUINO_VALIDATION_RESUME=1 仅用于同一核心与库环境中接续本轮编译；更换核心或库后请全量验证。
