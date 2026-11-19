// 03 · millis 多任务流水灯
// 接线：3 个 LED 分别经电阻接 GPIO39、40、41，负极接地；按键 GPIO42 接地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：3-1 millis定时机制.pptx 第 5、6、7 页
// 预期现象：移灯、每秒串口报告和按键计数同时执行；串口 115200。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PINS = {39,40,41}；STEP_MS = 500

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

// 内部上拉：按键接 GPIO42 与 GND；稳定 30ms 才接受状态改变。
const int BUTTON_PIN = 42;
int rawKey = HIGH, stableKey = HIGH;
unsigned long keyChangedAt = 0;
bool pressed(unsigned long now) {
  const int value = digitalRead(BUTTON_PIN);
  if (value != rawKey) { rawKey = value; keyChangedAt = now; }
  if (value != stableKey && now - keyChangedAt >= 30) {
    stableKey = value;
    return value == LOW;
  }
  return false;
}
const int LED_PINS[] = {39,40,41};
const unsigned long STEP_MS = 500;
unsigned long lastStep = 0, lastReport = 0, count = 0;
int indexLed = 0;
void setup() {
  Serial.begin(115200); pinMode(BUTTON_PIN, INPUT_PULLUP);
  for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  digitalWrite(LED_PINS[0], HIGH);
}
void loop() {
  const unsigned long now = millis();
  if (pressed(now)) ++count;
  if (now - lastStep >= STEP_MS) {
    lastStep = now; digitalWrite(LED_PINS[indexLed], LOW);
    indexLed = (indexLed + 1) % 3; digitalWrite(LED_PINS[indexLed], HIGH);
  }
  if (now - lastReport >= 1000) { lastReport = now; Serial.printf("已按 %lu 次\n", count); }
}
