// 09 · 电容触摸切换继电器
// 接线：TTP223 用 3.3V 兼容逻辑供电，OUT→GPIO7；继电器驱动模块 IN→GPIO8，按模块规格独立供电并共地。触点仅接低压 LED/小负载，先用指示灯测试。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：9-2 继电器与电容式触摸按键1.pptx 第 3、6、7 页
// 预期现象：触摸一次翻转开关，持续触摸不重复触发；上电默认关闭。模块须为点动模式。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：TOUCH_PIN = 7；RELAY_PIN = 8；RELAY_ACTIVE_LEVEL = HIGH
// 注意：低电平触发继电器请改 RELAY_ACTIVE_LEVEL；上电复位期间硬件也应保持关闭，软件不能替代驱动电路设计。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int TOUCH_PIN=7, RELAY_PIN=8;
const int RELAY_ACTIVE_LEVEL=HIGH;
int raw=LOW, stable=LOW;
unsigned long changedAt=0;
bool on=false;
void setup() {
  digitalWrite(RELAY_PIN,!RELAY_ACTIVE_LEVEL); pinMode(RELAY_PIN,OUTPUT); pinMode(TOUCH_PIN,INPUT);
  raw=stable=digitalRead(TOUCH_PIN);
}
void loop() {
  const unsigned long now=millis(); const int reading=digitalRead(TOUCH_PIN);
  if (reading!=raw) { raw=reading; changedAt=now; }
  if (reading!=stable && now-changedAt>=30) {
    stable=reading; if (stable==HIGH) { on=!on; digitalWrite(RELAY_PIN,on ? RELAY_ACTIVE_LEVEL : !RELAY_ACTIVE_LEVEL); }
  }
}
