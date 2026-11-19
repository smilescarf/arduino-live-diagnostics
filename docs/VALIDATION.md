# v0.3.0 验证记录

验证日期：2026-11-19；Windows / Arduino IDE 2.3.10。

- 35 项自动化测试通过，包含板型限制、模板生成、README 与不覆盖用户代码。
- 47 组完整编译通过：ESP32-S3 42 个模板（Arduino-ESP32 3.3.12）；Uno 5 个通用模板（AVR 1.8.8）。
- 编译库版本：FastLED 3.10.9、TM1637 1.2.0、LovyanGFX 1.3.0、ESP32Servo 3.2.1；WiFi/BLE/ESP-NOW 等使用 ESP32 核心。
- 42 份 examples 与插件模板源码一致。
- 实验板卡、外设接线和无线配对仍需实机验证；本次编译未上传或控制硬件。

复现：node --test test/*.test.js；node scripts/generate-examples.js；node scripts/validate-templates.js。工具路径可用 ARDUINO_IDE_PATH、ARDUINO_CLI_CONFIG 指定；板型可用 ARDUINO_TEST_BOARDS 指定。ARDUINO_VALIDATION_RESUME=1 仅用于同一核心与库环境中接续本轮编译；更换核心或库后请全量验证。
