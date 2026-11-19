// 05 · 八灯电压进度条
// 接线：电位器中间脚接 GPIO1；8 个 LED 分别经 1kΩ 接 GPIO4～11，负极接地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：5-1 数模转换器.pptx 第 11 页
// 预期现象：电位器由低到高时点亮 0～8 个 LED。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：ADC_PIN = 1；LED_PINS = {4,5,6,7,8,9,10,11}
// 注意：避开部分 S3 模组被 Flash/PSRAM 占用的 GPIO35～37，改用 GPIO4～11。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int ADC_PIN = 1;
const int LED_PINS[] = {4,5,6,7,8,9,10,11};
unsigned long previous = 0;
void setup() { analogReadResolution(12); analogSetPinAttenuation(ADC_PIN, ADC_11db); for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); } }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= 50) {
    previous = now; const int count = constrain(map(analogRead(ADC_PIN), 0, 4095, 0, 8), 0L, 8L);
    for (int i = 0; i < 8; ++i) digitalWrite(LED_PINS[i], i < count ? HIGH : LOW);
  }
}
