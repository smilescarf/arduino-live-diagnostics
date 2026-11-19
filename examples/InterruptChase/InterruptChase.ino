// 03 · 外部中断与非阻塞流水灯
// 接线：LED39、40、41 各串电阻接地；按键 GPIO42 接地，内部上拉。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：3-2 GPIO外部中断.pptx 第 6、7、8、9 页
// 预期现象：按键中断记录边沿，主循环消抖并切换流水方向。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：BUTTON_PIN = 42；STEP_MS = 250
// 注意：中断内仅设置标志；不做串口输出、延时或消抖。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_PINS[] = {39,40,41};
const int BUTTON_PIN = 42;
const unsigned long STEP_MS = 250;
portMUX_TYPE keyMux = portMUX_INITIALIZER_UNLOCKED;
volatile bool edgePending = false;
bool waiting = false, armed = true;
int candidate = HIGH, indexLed = 0, direction = 1;
unsigned long changedAt = 0, lastStep = 0;
void ARDUINO_ISR_ATTR onKeyEdge() {
  portENTER_CRITICAL_ISR(&keyMux); edgePending = true; portEXIT_CRITICAL_ISR(&keyMux);
}
void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  digitalWrite(LED_PINS[0], HIGH);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onKeyEdge, CHANGE);
}
void loop() {
  const unsigned long now = millis();
  portENTER_CRITICAL(&keyMux); const bool edge = edgePending; edgePending = false; portEXIT_CRITICAL(&keyMux);
  const int reading = digitalRead(BUTTON_PIN);
  if (edge || reading != candidate) { candidate = reading; changedAt = now; waiting = true; }
  if (waiting && now - changedAt >= 30) {
    waiting = false;
    if (candidate == HIGH) armed = true;
    else if (armed) { armed = false; direction = -direction; }
  }
  if (now - lastStep >= STEP_MS) {
    lastStep = now; digitalWrite(LED_PINS[indexLed], LOW);
    indexLed = (indexLed + direction + 3) % 3; digitalWrite(LED_PINS[indexLed], HIGH);
  }
}
