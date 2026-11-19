// LED 流水灯
// 接线：3 个 LED，各自串联电阻后接 GPIO4、5、6，负极接 GND。
// 当前诊断板型：未选择
// 适用板型：Uno / ESP32-S3（按板卡调整引脚）
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：按接线说明连接，修改参数后观察效果。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PINS[] = {4, 5, 6}

const int LED_PINS[] = {4, 5, 6};
const int LED_COUNT = sizeof(LED_PINS) / sizeof(LED_PINS[0]);
const unsigned long STEP_MS = 250;
unsigned long lastStep = 0;
int currentLed = 0;

void setup() {
  for (int i = 0; i < LED_COUNT; ++i) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
  digitalWrite(LED_PINS[currentLed], HIGH);
}

void loop() {
  const unsigned long now = millis();
  if (now - lastStep >= STEP_MS) {
    lastStep = now;
    digitalWrite(LED_PINS[currentLed], LOW);
    currentLed = (currentLed + 1) % LED_COUNT;
    digitalWrite(LED_PINS[currentLed], HIGH);
  }
}
