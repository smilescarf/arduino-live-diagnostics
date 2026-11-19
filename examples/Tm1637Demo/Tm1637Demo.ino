// 07 · TM1637 常用显示 API
// 接线：TM1637：CLK→GPIO48，DIO→GPIO47，GND→GND，使用支持 3.3V 供电/逻辑的模块。GPIO48 若被板载 RGB LED 占用请换脚。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：TM1637
// 来源：7-2 TM1637数码管模块.pptx 第 3、4、5 页
// 预期现象：依次显示数字、负数、冒号和横杠。小数点/冒号形状由模块硬件决定。
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
int stage=0;
void setup() { display.setBrightness(4); display.clear(); }
void loop() {
  const unsigned long now=millis(); if (now-previous<1000) return; previous=now;
  switch (stage) {
    case 0: display.showNumberDec(1234); break;
    case 1: display.showNumberDec(-123); break;
    case 2: display.showNumberDecEx(1234,0x40,true); break;
    case 3: { const uint8_t dash[]={0x40,0x40,0x40,0x40}; display.setSegments(dash); break; }
  }
  stage=(stage+1)%4;
}
