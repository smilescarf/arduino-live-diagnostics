// 02 · 按键消抖控灯
// 接线：外接 LED 正极经 1kΩ 电阻接 GPIO41，负极接 GND。 按键接 GPIO42 和 GND，无需外部上拉。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：2-1 按键及去抖动.pptx 第 7、8、19、24 页
// 预期现象：每按下一次切换亮灭；长按只切换一次。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 41；BUTTON_PIN = 42

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

// 内部上拉：按键接 GPIO42 与 GND；稳定 30ms 才接受状态改变。
const int BUTTON_PIN = 42;
int rawKey = HIGH, stableKey = HIGH;
unsigned long keyChangedAt = 0;
bool pressed(unsigned long now) {
  const int value = digitalRead(BUTTON_PIN);
  if (value != rawKey) { rawKey = value; keyChangedAt = now; }
  if (value != stableKey && now - keyChangedAt >= 30) {
    stableKey = value;
    return value == LOW;
  }
  return false;
}
const int LED_PIN = 41;
bool on = false;
void setup() {
  pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW);
  pinMode(BUTTON_PIN, INPUT_PULLUP); Serial.begin(115200);
}
void loop() {
  if (pressed(millis())) { on = !on; digitalWrite(LED_PIN, on ? HIGH : LOW); Serial.println(on ? "亮" : "灭"); }
}
