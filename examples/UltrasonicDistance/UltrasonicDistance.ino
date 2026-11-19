// 08 · 超声波测距与超时处理
// 接线：超声波 Trig→GPIO5、Echo→GPIO6，共地。按模块规格供电；5V Echo 必须经过分压/电平转换到 ESP32 允许的电平。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：8-2 超声波测距及舵机应用.pptx 第 3、4 页
// 预期现象：串口每 200ms 显示距离；无回波显示“超时”，最长等待 25ms。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：TRIG_PIN = 5；ECHO_PIN = 6；TIMEOUT_US = 25000
// 注意：pulseIn 是有界阻塞调用（最多 25ms），不是后台异步测距。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int TRIG_PIN=5, ECHO_PIN=6;
float distanceCm() {
  digitalWrite(TRIG_PIN,LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN,HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN,LOW);
  const unsigned long duration=pulseIn(ECHO_PIN,HIGH,25000UL);
  return duration ? duration*0.0343f/2.0f : -1.0f; // 超时不能当作 0cm
}
unsigned long previous=0;
void setup() { Serial.begin(115200); pinMode(TRIG_PIN,OUTPUT); digitalWrite(TRIG_PIN,LOW); pinMode(ECHO_PIN,INPUT); }
void loop() {
  const unsigned long now=millis(); if (now-previous<200) return; previous=now;
  const float cm=distanceCm(); if (cm<0) Serial.println("无回波/超时"); else Serial.printf("%.1f cm\n",cm);
}
