// 04 · 双 LED 同通道同步呼吸
// 接线：LED 各串 1kΩ，分别接 GPIO1、GPIO2，负极接地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：4-2 PWM原理及应用.pptx 第 11 页
// 预期现象：两个引脚共享一个 PWM 通道，同时渐亮渐灭。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_A = 1；LED_B = 2；CHANNEL = 0

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_A = 1, LED_B = 2, CHANNEL = 0;
bool ready = false;
unsigned long previous = 0;
void setup() {
  Serial.begin(115200);
  ready = ledcAttachChannel(LED_A, 1000, 10, CHANNEL);
  ready = ledcAttachChannel(LED_B, 1000, 10, CHANNEL) && ready;
  if (!ready) Serial.println("共享 PWM 通道初始化失败");
}
void loop() {
  const unsigned long now = millis();
  if (ready && now - previous >= 10) {
    previous = now; const unsigned long phase = now % 4000;
    ledcWriteChannel(CHANNEL, map(phase < 2000 ? phase : 4000-phase, 0, 2000, 0, 1023));
  }
}
