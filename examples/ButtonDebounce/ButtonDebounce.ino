// 按键消抖与按下计数
// 接线：按键两端分别接 GPIO4 和 GND，使用内部上拉。按下为 LOW。打开串口监视器，波特率 115200。
// 当前诊断板型：未选择
// 适用板型：Uno / ESP32-S3（按板卡调整引脚）
// 依赖库：开发板核心自带
// 来源：补充实验
// 预期现象：按接线说明连接，修改参数后观察效果。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：BUTTON_PIN = 4

const int BUTTON_PIN = 4;
const unsigned long DEBOUNCE_MS = 30;
int lastReading = HIGH;
int stableState = HIGH;
unsigned long changedAt = 0;
unsigned long pressCount = 0;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  Serial.begin(115200);
  lastReading = stableState = digitalRead(BUTTON_PIN);
}

void loop() {
  const int reading = digitalRead(BUTTON_PIN);
  const unsigned long now = millis();
  if (reading != lastReading) {
    lastReading = reading;
    changedAt = now;
  }
  if (reading != stableState && now - changedAt >= DEBOUNCE_MS) {
    stableState = reading;
    if (stableState == LOW) {
      ++pressCount;
      Serial.println(pressCount); // 一次按下只计一次，不会在长按时持续累加
    }
  }
}
