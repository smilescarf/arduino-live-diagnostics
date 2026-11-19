// 07 · 单位数码管 0～9
// 接线：共阴数码管公共阴极接地；a,b,c,d,e,f,g,dp 分别经 1kΩ 接 GPIO4～11。共阳管需改 COMMON_ANODE 并接 3.3V。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：7-1 数码管显示.pptx 第 3、4、5 页
// 预期现象：每秒显示下一个数字；学习段码与数组。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：SEG_PINS = {4,5,6,7,8,9,10,11}；COMMON_ANODE = false
// 注意：课件 GPIO35～42 改为 GPIO4～11，避开部分 S3 模组的存储器引脚；按段名接线，不能只看外壳脚号。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

// a,b,c,d,e,f,g,dp 各串 1kΩ；以下为共阴段码。
const int SEG_PINS[] = {4,5,6,7,8,9,10,11};
const uint8_t DIGITS[] = {0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f};
const bool COMMON_ANODE = false;
void writeSegments(int number) {
  const uint8_t mask = DIGITS[number % 10];
  for (int i=0; i<8; ++i) {
    const bool lit = (mask >> i) & 1;
    digitalWrite(SEG_PINS[i], lit != COMMON_ANODE ? HIGH : LOW);
  }
}
unsigned long previous = 0;
int value = 0;
void setup() { for (int pin : SEG_PINS) pinMode(pin, OUTPUT); writeSegments(0); }
void loop() { const unsigned long now = millis(); if (now-previous >= 1000) { previous=now; value=(value+1)%10; writeSegments(value); } }
