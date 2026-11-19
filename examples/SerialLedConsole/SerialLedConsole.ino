// 拓展 · 串口指令调试台
// 接线：LED41 经 1kΩ 接地；串口监视器 115200，发送行尾选择换行。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：发送 ON/OFF/STATUS，看到明确回复；超长行整行拒绝，便于理解指令边界。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 41；BUFFER_SIZE = 32

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

const int LED_PIN=41;
char line[32]; size_t used=0; bool overflow=false, on=false;
void setup() { Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW); }
void loop() {
  for (int budget=0;Serial.available() && budget<64;++budget) {
    const char c=char(Serial.read()); if (c=='\r') continue;
    if (c=='\n') {
      line[used]='\0';
      if (overflow) Serial.println("指令太长");
      else if (!strcmp(line,"ON")) { on=true; Serial.println("OK ON"); }
      else if (!strcmp(line,"OFF")) { on=false; Serial.println("OK OFF"); }
      else if (!strcmp(line,"STATUS")) Serial.println(on ? "ON" : "OFF");
      else Serial.println("支持 ON / OFF / STATUS");
      digitalWrite(LED_PIN,on ? HIGH : LOW); used=0; overflow=false;
    } else if (!overflow && used<sizeof(line)-1) line[used++]=c; else overflow=true;
  }
}
