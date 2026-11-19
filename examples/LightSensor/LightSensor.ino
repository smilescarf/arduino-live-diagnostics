// 05 · 光敏电阻感光灯（带回差）
// 接线：3.3V → 光敏电阻 → GPIO1 测量点 → 10kΩ → GND；LED41 经电阻接地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：5-1 数模转换器.pptx 第 10 页
// 预期现象：较暗时点亮，较亮时熄灭；两阈值避免临界点反复闪烁。先看串口再校准阈值。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：ADC_PIN = 1；DARK_ON = 1000；BRIGHT_OFF = 1400

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int ADC_PIN = 1, LED_PIN = 41;
const int DARK_ON = 1000, BRIGHT_OFF = 1400;
unsigned long previous = 0;
bool on = false;
void setup() { Serial.begin(115200); pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); analogReadResolution(12); analogSetPinAttenuation(ADC_PIN, ADC_11db); }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= 100) {
    previous = now; const int raw = analogRead(ADC_PIN);
    if (raw < DARK_ON) on = true; else if (raw > BRIGHT_OFF) on = false;
    digitalWrite(LED_PIN, on ? HIGH : LOW); Serial.println(raw);
  }
}
