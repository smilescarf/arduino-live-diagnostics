// LED 闪烁（非阻塞）
// 接线：LED、220Ω～1kΩ 电阻。GPIO → 电阻 → LED 正极，LED 负极 → GND。
// 当前诊断板型：未选择
// 适用板型：Uno / ESP32-S3（按板卡调整引脚）
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：按接线说明连接，修改参数后观察效果。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 4

const int LED_PIN = 4;
const unsigned long INTERVAL_MS = 500;
unsigned long lastChange = 0;
bool ledOn = false;

void setup() {
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);
}

void loop() {
  const unsigned long now = millis();
  if (now - lastChange >= INTERVAL_MS) {
    lastChange = now;
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
  }
}
