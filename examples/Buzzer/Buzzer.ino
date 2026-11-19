// 无源蜂鸣器提示音
// 接线：使用与开发板电平兼容的低功耗无源蜂鸣器模块：信号脚接 GPIO4，共地；电源按模块说明连接。普通大电流蜂鸣器须通过驱动电路连接。
// 当前诊断板型：未选择
// 适用板型：Uno / ESP32-S3（按板卡调整引脚）
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：按接线说明连接，修改参数后观察效果。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：BUZZER_PIN = 4

const int BUZZER_PIN = 4;
unsigned long lastBeep = 0;

void setup() {
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
}

void loop() {
  const unsigned long now = millis();
  if (now - lastBeep >= 1000) {
    lastBeep = now;
    tone(BUZZER_PIN, 1000, 150); // 1000Hz，响 150ms；有源蜂鸣器请用 digitalWrite 开关
  }
}
