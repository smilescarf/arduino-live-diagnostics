// 07 · 60 秒倒计时与结束闪烁
// 接线：TM1637：CLK→GPIO48，DIO→GPIO47，GND→GND，使用支持 3.3V 供电/逻辑的模块。GPIO48 若被板载 RGB LED 占用请换脚。 可选：按键 GPIO42 接地以重新计时；板上的复位键同样会重新开始。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：TM1637
// 来源：7-2 TM1637数码管模块.pptx 第 7 页
// 预期现象：倒数到 0 停止并闪烁；按键消抖后重新开始。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：START_SECONDS = 60；BUTTON_PIN = 42

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <TM1637Display.h>
const int CLK_PIN=48, DIO_PIN=47;
TM1637Display display(CLK_PIN,DIO_PIN);
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
const int START_SECONDS=60;
int remaining=START_SECONDS;
unsigned long lastSecond=0, lastBlink=0;
bool visible=true;
void setup() { pinMode(BUTTON_PIN,INPUT_PULLUP); display.setBrightness(4); display.showNumberDec(remaining,true); }
void loop() {
  const unsigned long now=millis();
  if (pressed(now)) { remaining=START_SECONDS; lastSecond=now; visible=true; display.setBrightness(4,true); display.showNumberDec(remaining,true); }
  if (remaining>0 && now-lastSecond>=1000) {
    const unsigned long elapsed=(now-lastSecond)/1000; lastSecond+=elapsed*1000;
    remaining=elapsed>=(unsigned long)remaining ? 0 : remaining-int(elapsed);
    display.showNumberDec(remaining,true);
  }
  if (remaining==0 && now-lastBlink>=500) { lastBlink=now; visible=!visible; display.setBrightness(4,visible); display.showNumberDec(0,true); }
}
