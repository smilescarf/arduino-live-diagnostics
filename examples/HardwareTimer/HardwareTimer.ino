// 04 · 硬件定时器闪灯
// 接线：外接 LED 正极经 1kΩ 电阻接 GPIO41，负极接 GND。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：4-1 通用定时器.pptx 第 6、7、8 页
// 预期现象：硬件每秒产生一次中断；主循环处理累计事件并输出计数。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：TIMER_HZ = 1000000；ALARM_TICKS = 1000000
// 注意：使用 Arduino-ESP32 3.x timerBegin/AttachInterrupt/Alarm API。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_PIN = 41;
const uint32_t TIMER_HZ = 1000000;
const uint64_t ALARM_TICKS = 1000000;
hw_timer_t *timer = nullptr;
portMUX_TYPE timerMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t pendingTicks = 0;
bool on = false;
void ARDUINO_ISR_ATTR onTimer() {
  portENTER_CRITICAL_ISR(&timerMux); ++pendingTicks; portEXIT_CRITICAL_ISR(&timerMux);
}
void setup() {
  Serial.begin(115200); pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW);
  timer = timerBegin(TIMER_HZ);
  if (!timer) { Serial.println("定时器申请失败"); return; }
  timerAttachInterrupt(timer, &onTimer);
  timerAlarm(timer, ALARM_TICKS, true, 0);
}
void loop() {
  portENTER_CRITICAL(&timerMux); const uint32_t ticks = pendingTicks; pendingTicks = 0; portEXIT_CRITICAL(&timerMux);
  if (ticks) { if (ticks % 2) on = !on; digitalWrite(LED_PIN, on ? HIGH : LOW); Serial.println(ticks); }
}
