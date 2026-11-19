// 01 · 点亮与闪烁 LED
// 接线：外接 LED 正极经 1kΩ 电阻接 GPIO41，负极接 GND。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：1-2 点亮LED灯.pptx 第 7、10 页
// 预期现象：LED 每秒切换亮灭；把 INTERVAL_MS 改成 200 比较快慢。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 41；INTERVAL_MS = 1000
// 注意：课件 GPIO45 改为 GPIO41，避开启动配置引脚；采用 millis，便于后续同时检测按键。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_PIN = 41;
const unsigned long INTERVAL_MS = 1000;
unsigned long previous = 0;
bool on = false;
void setup() { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= INTERVAL_MS) {
    previous = now; on = !on; digitalWrite(LED_PIN, on ? HIGH : LOW);
  }
}
