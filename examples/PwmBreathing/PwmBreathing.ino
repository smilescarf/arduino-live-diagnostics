// 04 · LEDC 呼吸灯
// 接线：外接 LED 正极经 1kΩ 电阻接 GPIO41，负极接 GND。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：4-2 PWM原理及应用.pptx 第 5、6 页
// 预期现象：2 秒渐亮、2 秒渐灭；修改周期和 PWM 分辨率观察变化。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 41；CYCLE_MS = 4000

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_PIN = 41;
const unsigned long CYCLE_MS = 4000;
bool ready = false;
unsigned long lastFrame = 0;
void setup() { Serial.begin(115200); ready = ledcAttach(LED_PIN, 1000, 10); if (!ready) Serial.println("LEDC 初始化失败"); }
void loop() {
  const unsigned long now = millis();
  if (ready && now - lastFrame >= 10) {
    lastFrame = now; const unsigned long phase = now % CYCLE_MS;
    const unsigned long ramp = phase < CYCLE_MS/2 ? phase : CYCLE_MS-phase;
    ledcWrite(LED_PIN, map(ramp, 0, CYCLE_MS/2, 0, 1023));
  }
}
