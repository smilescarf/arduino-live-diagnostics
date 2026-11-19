// 拓展 · 红绿灯状态机
// 接线：红、黄、绿 LED 经各自 1kΩ 分别接 GPIO39、40、41，负极接地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：红 5 秒→绿 5 秒→黄 1 秒；用状态与时间表驱动，不靠多段 delay。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：PINS = {39,40,41}；DURATIONS（红/绿/黄）= {5000,5000,1000}

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int PINS[]={39,40,41};
const uint8_t ORDER[]={0,2,1};
const unsigned long DURATIONS[]={5000,5000,1000};
uint8_t phase=0;
unsigned long changedAt=0;
void setup() { for (int pin:PINS) { pinMode(pin,OUTPUT); digitalWrite(pin,LOW); } digitalWrite(PINS[ORDER[0]],HIGH); }
void loop() {
  const unsigned long now=millis(); if (now-changedAt<DURATIONS[phase]) return;
  digitalWrite(PINS[ORDER[phase]],LOW); phase=(phase+1)%3; changedAt=now; digitalWrite(PINS[ORDER[phase]],HIGH);
}
