// 05 · 电位器与校准电压读取
// 接线：电位器两端接 3.3V 与 GND，中间滑动端接 GPIO1；不得超过芯片输入额定电压。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：5-1 数模转换器.pptx 第 7、9 页
// 预期现象：串口同时输出原始值和校准毫伏值；不会把 ADC 读数误当精确的 0～3.3V 线性关系。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：ADC_PIN = 1；INTERVAL_MS = 200

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int ADC_PIN = 1;
const unsigned long INTERVAL_MS = 200;
unsigned long previous = 0;
void setup() { Serial.begin(115200); analogReadResolution(12); analogSetPinAttenuation(ADC_PIN, ADC_11db); }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= INTERVAL_MS) { previous = now; Serial.printf("raw=%d, mV=%lu\n", analogRead(ADC_PIN), (unsigned long)analogReadMilliVolts(ADC_PIN)); }
}
