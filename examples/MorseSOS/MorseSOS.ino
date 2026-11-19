// 01 · SOS 莫尔斯灯
// 接线：外接 LED 正极经 1kΩ 电阻接 GPIO41，负极接 GND。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：1-2 点亮LED灯.pptx 第 14 页
// 预期现象：三短、三长、三短循环；修改 UNIT_MS 改变速度。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 41；UNIT_MS = 150
// 注意：采用标准莫尔斯码的字母/组间隔；与课件整组停 1 秒的演示略有不同。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_PIN = 41;
const unsigned long UNIT_MS = 150;
// 亮灭时长按一个单位计算：字母间 3 单位，整组间 7 单位。
const uint8_t durationUnits[] = {1,1,1,1,1,3,3,1,3,1,3,3,1,1,1,1,1,7};
uint8_t phase = 0;
unsigned long changedAt = 0;
void setup() { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, HIGH); }
void loop() {
  const unsigned long now = millis();
  if (now - changedAt >= UNIT_MS * durationUnits[phase]) {
    changedAt = now; phase = (phase + 1) % sizeof(durationUnits);
    digitalWrite(LED_PIN, phase % 2 == 0 ? HIGH : LOW);
  }
}
