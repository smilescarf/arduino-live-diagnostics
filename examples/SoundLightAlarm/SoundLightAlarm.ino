// 04 · 同步声光报警器
// 接线：外接 LED 正极经 1kΩ 电阻接 GPIO41，负极接 GND。 无源蜂鸣器模块信号接 GPIO4，共地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：4-2 PWM原理及应用.pptx 第 11 页
// 预期现象：LED 亮度和音高按同一个波形变化；学习 map、sin 和独立 PWM 通道。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 41；BUZZER_PIN = 4

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_PIN = 41, BUZZER_PIN = 4;
bool ready = false;
unsigned long previous = 0;
void setup() {
  Serial.begin(115200);
  // 显式使用不同定时器所对应的通道，改变音高不影响 LED 的频率。
  ready = ledcAttachChannel(LED_PIN, 1000, 10, 0);
  ready = ledcAttachChannel(BUZZER_PIN, 2000, 10, 2) && ready;
  if (!ready) Serial.println("声光输出初始化失败");
}
void loop() {
  const unsigned long now = millis();
  if (ready && now - previous >= 10) {
    previous = now;
    const int wave = int((sinf((now % 2000) * 2*PI/2000.0f) + 1)*511.5f);
    ledcWrite(LED_PIN, wave); ledcWriteTone(BUZZER_PIN, map(wave, 0, 1023, 1000, 2000));
  }
}
