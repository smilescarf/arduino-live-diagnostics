// 04 · 无源蜂鸣器音阶与警报
// 接线：低功耗无源蜂鸣器模块信号接 GPIO4，电源按模块规格，共地；大电流器件使用驱动模块。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：4-2 PWM原理及应用.pptx 第 8、9、10 页
// 预期现象：MODE=0 循环 C 大调音阶；MODE=1 输出平滑升降的警报音。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：BUZZER_PIN = 4；MODE = 0（音阶）或 1（警报）

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int BUZZER_PIN = 4;
const int MODE = 0;
const note_t notes[] = {NOTE_C,NOTE_D,NOTE_E,NOTE_F,NOTE_G,NOTE_A,NOTE_B};
unsigned long previous = 0;
int noteIndex = 0;
bool ready = false;
void setup() { Serial.begin(115200); ready = ledcAttach(BUZZER_PIN, 1000, 10); if (!ready) Serial.println("蜂鸣器初始化失败"); }
void loop() {
  const unsigned long now = millis();
  if (!ready) return;
  if (MODE == 0 && now - previous >= 400) {
    previous = now;
    if (noteIndex < 7) ledcWriteNote(BUZZER_PIN, notes[noteIndex], 4); else ledcWriteTone(BUZZER_PIN, 0);
    noteIndex = (noteIndex + 1) % 9;
  } else if (MODE == 1 && now - previous >= 10) {
    previous = now; const float wave = sinf((now % 1800) * PI / 1800.0f);
    ledcWriteTone(BUZZER_PIN, 1000 + int(wave * 1000));
  }
}
