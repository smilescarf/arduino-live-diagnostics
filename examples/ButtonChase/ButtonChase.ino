// 02 · 按键切换四灯流水方向
// 接线：4 个 LED 分别经 1kΩ 接 GPIO38、39、40、41，负极接地；按键 GPIO42 接地。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：2-1 按键及去抖动.pptx 第 12 页
// 预期现象：流水灯一直运行；每次按键反转方向，不中断移灯。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PINS = {38,39,40,41}；STEP_MS = 250

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
const int LED_PINS[] = {38,39,40,41};
const unsigned long STEP_MS = 250;
unsigned long previous = 0;
int indexLed = 0, direction = 1;
void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  digitalWrite(LED_PINS[0], HIGH);
}
void loop() {
  const unsigned long now = millis();
  if (pressed(now)) direction = -direction;
  if (now - previous >= STEP_MS) {
    previous = now; digitalWrite(LED_PINS[indexLed], LOW);
    indexLed = (indexLed + direction + 4) % 4; digitalWrite(LED_PINS[indexLed], HIGH);
  }
}
