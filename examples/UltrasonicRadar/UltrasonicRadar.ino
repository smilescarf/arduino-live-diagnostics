// 08 · 舵机超声波雷达与近距报警
// 接线：超声波 Trig→GPIO5、Echo→GPIO6，共地。按模块规格供电；5V Echo 必须经过分压/电平转换到 ESP32 允许的电平。 舵机信号4、独立5V供电且共地；LED41 串电阻接地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：ESP32Servo
// 来源：8-2 超声波测距及舵机应用.pptx 第 8 页
// 预期现象：每次舵机移动后等待稳定，再输出角度/距离；近于 20cm 点亮 LED。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：SERVO_PIN = 4；SCAN=30～150°；ALARM_CM = 20
// 注意：串口输出 cm=-1 表示超时；pulseIn 最长阻塞 25ms。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <ESP32Servo.h>
const int TRIG_PIN=5, ECHO_PIN=6;
float distanceCm() {
  digitalWrite(TRIG_PIN,LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN,HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN,LOW);
  const unsigned long duration=pulseIn(ECHO_PIN,HIGH,25000UL);
  return duration ? duration*0.0343f/2.0f : -1.0f; // 超时不能当作 0cm
}
const int SERVO_PIN=4, LED_PIN=41;
const float ALARM_CM=20;
Servo arm;
int angle=30, direction=5;
unsigned long movedAt=0;
void setup() {
  Serial.begin(115200); pinMode(TRIG_PIN,OUTPUT); digitalWrite(TRIG_PIN,LOW); pinMode(ECHO_PIN,INPUT);
  pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW);
  arm.setPeriodHertz(50); arm.attach(SERVO_PIN,600,2400); arm.write(angle); movedAt=millis();
}
void loop() {
  const unsigned long now=millis(); if (now-movedAt<150) return;
  const float cm=distanceCm(); Serial.printf("angle=%d,cm=%.1f\n",angle,cm);
  digitalWrite(LED_PIN,cm>=0 && cm<ALARM_CM ? HIGH : LOW);
  if (angle>=150) direction=-5; else if (angle<=30) direction=5;
  angle+=direction; arm.write(angle); movedAt=millis();
}
