// 拓展 · 光电/数字霍尔去抖计数
// 接线：带数字输出的 3.3V 兼容光电或霍尔模块，OUT→GPIO7、GND 共地，按模块规格供电；开漏输出使用 3.3V 上拉。不是直接连接裸光电二极管。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：遮挡或磁铁靠近时计数一次，串口观察；适合慢速教学，非高速转速计。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：SENSOR_PIN = 7；ACTIVE_LEVEL = LOW；STABLE_MS = 5
// 注意：补充实现：所提供 9-1 文件内文与超声波/舵机章节重复，未从该文件虚构接线或实验要求。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int SENSOR_PIN=7, ACTIVE_LEVEL=LOW;
const unsigned long STABLE_MS=5;
int raw=HIGH, stable=HIGH;
unsigned long changedAt=0, count=0;
void setup() { Serial.begin(115200); pinMode(SENSOR_PIN,INPUT_PULLUP); raw=stable=digitalRead(SENSOR_PIN); }
void loop() {
  const unsigned long now=millis(); const int value=digitalRead(SENSOR_PIN);
  if (value!=raw) { raw=value; changedAt=now; }
  if (value!=stable && now-changedAt>=STABLE_MS) { stable=value; if (stable==ACTIVE_LEVEL) Serial.println(++count); }
}
