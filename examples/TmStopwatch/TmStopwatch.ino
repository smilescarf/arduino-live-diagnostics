// 07 · TM1637 分秒计时
// 接线：TM1637：CLK→GPIO48，DIO→GPIO47，GND→GND，使用支持 3.3V 供电/逻辑的模块。GPIO48 若被板载 RGB LED 占用请换脚。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：TM1637
// 来源：7-2 TM1637数码管模块.pptx 第 6 页
// 预期现象：从 00:00 到 59:59 循环；每秒更新，保留前导零。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：CLK_PIN = 48；DIO_PIN = 47

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
unsigned long previous=0;
unsigned int seconds=0;
void setup() { display.setBrightness(4); display.showNumberDecEx(0,0x40,true); }
void loop() {
  const unsigned long now=millis();
  if (now-previous>=1000) {
    const unsigned long elapsed=(now-previous)/1000; previous+=elapsed*1000;
    seconds=(seconds+elapsed)%3600; display.showNumberDecEx((seconds/60)*100+seconds%60,0x40,true);
  }
}
