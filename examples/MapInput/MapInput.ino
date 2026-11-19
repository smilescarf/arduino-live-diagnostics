// 模拟输入与 map 数值映射
// 接线：电位器中间脚接模拟输入，两端接开发板允许的模拟参考电源与 GND。Uno 用 A0；ESP32S3 用支持 ADC 的 GPIO4。按实际 ADC 分辨率修改 ADC_MAX。
// 当前诊断板型：未选择
// 适用板型：Uno / ESP32-S3（按板卡调整引脚）
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：按接线说明连接，修改参数后观察效果。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：INPUT_PIN = A0 或 4；ADC_MAX = 1023 或 4095

#if defined(ARDUINO_ARCH_ESP32)
const int INPUT_PIN = 4;
const long ADC_MAX = 4095;
#else
const int INPUT_PIN = A0;
const long ADC_MAX = 1023;
#endif
unsigned long lastPrint = 0;

void setup() {
  Serial.begin(115200);
#if defined(ARDUINO_ARCH_ESP32)
  analogReadResolution(12);
#endif
}

void loop() {
  const unsigned long now = millis();
  if (now - lastPrint >= 100) {
    lastPrint = now;
    const int raw = analogRead(INPUT_PIN);
    const long percent = constrain(map(raw, 0, ADC_MAX, 0, 100), 0L, 100L);
    Serial.println(percent); // map 使用整数运算；constrain 限制输出范围
  }
}
