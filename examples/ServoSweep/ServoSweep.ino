// 08 · 舵机限幅往返
// 接线：舵机信号 GPIO4；舵机使用独立的合适 5V 电源并与 ESP32 共地，不由 3.3V 引脚供电。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：ESP32Servo
// 来源：8-2 超声波测距及舵机应用.pptx 第 6、7 页
// 预期现象：在安全角度内缓慢往返；先查舵机规格再改脉宽和角度，避免顶死。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：SERVO_PIN = 4；MIN_ANGLE=30 MAX_ANGLE=150；PULSE_US=600～2400

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <ESP32Servo.h>
const int SERVO_PIN=4, MIN_ANGLE=30, MAX_ANGLE=150;
Servo arm;
int angle=MIN_ANGLE, direction=1;
unsigned long previous=0;
void setup() { arm.setPeriodHertz(50); arm.attach(SERVO_PIN,600,2400); arm.write(angle); }
void loop() {
  const unsigned long now=millis(); if (now-previous<30) return; previous=now;
  angle+=direction; if (angle>=MAX_ANGLE || angle<=MIN_ANGLE) direction=-direction;
  arm.write(angle);
}
