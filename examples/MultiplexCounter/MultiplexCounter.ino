// 07 · 两位数码管动态扫描计数
// 接线：共阴两位数码管 a～dp 经各自 1kΩ 接 GPIO4～11；两位公共阴极分别经 NPN/驱动器接地，驱动输入接 GPIO12、13（基极串电阻），不要让 GPIO 直接承担整位电流。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：7-1 数码管显示.pptx 第 6、7、8 页
// 预期现象：每 2ms 扫描一位，00～99 每秒加一；切位前先关闭两位防重影。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：DIGIT_PINS = {12,13}；DIGIT_ON = HIGH
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
const int DIGIT_PINS[] = {12,13};
const int DIGIT_ON = HIGH; // NPN 低侧驱动，高电平使能；按驱动电路修改。
unsigned long lastScan=0, lastCount=0;
int activeDigit=0, value=0;
void setup() {
  for (int pin : SEG_PINS) pinMode(pin, OUTPUT);
  for (int pin : DIGIT_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, !DIGIT_ON); }
}
void loop() {
  const unsigned long now=millis();
  if (now-lastCount>=1000) { lastCount=now; value=(value+1)%100; }
  if (now-lastScan>=2) {
    lastScan=now;
    for (int pin : DIGIT_PINS) digitalWrite(pin, !DIGIT_ON);
    activeDigit=1-activeDigit; writeSegments(activeDigit==0 ? value/10 : value%10);
    digitalWrite(DIGIT_PINS[activeDigit], DIGIT_ON);
  }
}
