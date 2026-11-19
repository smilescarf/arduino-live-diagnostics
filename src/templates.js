'use strict';

const templates = [
  { id: 'LedBlink', title: 'LED 闪烁（非阻塞）', parts: 'LED、220Ω～1kΩ 电阻。GPIO → 电阻 → LED 正极，LED 负极 → GND。', pins: ['LED_PIN = 4'], body: `const int LED_PIN = 4;
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
` },
  { id: 'LedChase', title: 'LED 流水灯', parts: '3 个 LED，各自串联电阻后接 GPIO4、5、6，负极接 GND。', pins: ['LED_PINS[] = {4, 5, 6}'], body: `const int LED_PINS[] = {4, 5, 6};
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
` },
  { id: 'Buzzer', title: '无源蜂鸣器提示音', parts: '使用与开发板电平兼容的低功耗无源蜂鸣器模块：信号脚接 GPIO4，共地；电源按模块说明连接。普通大电流蜂鸣器须通过驱动电路连接。', pins: ['BUZZER_PIN = 4'], body: `const int BUZZER_PIN = 4;
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
` },
  { id: 'ButtonDebounce', title: '按键消抖与按下计数', parts: '按键两端分别接 GPIO4 和 GND，使用内部上拉。按下为 LOW。打开串口监视器，波特率 115200。', pins: ['BUTTON_PIN = 4'], body: `const int BUTTON_PIN = 4;
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
` },
  { id: 'MapInput', title: '模拟输入与 map 数值映射', parts: '电位器中间脚接模拟输入，两端接开发板允许的模拟参考电源与 GND。Uno 用 A0；ESP32S3 用支持 ADC 的 GPIO4。按实际 ADC 分辨率修改 ADC_MAX。', pins: ['INPUT_PIN = A0 或 4', 'ADC_MAX = 1023 或 4095'], body: `#if defined(ARDUINO_ARCH_ESP32)
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
` }
];

const course = require('./course-templates');
require('./network-templates');
for (const template of templates) {
  Object.assign(template, { category: '通用入门', level: '基础', libraries: [], source: null,
    outcome: '按接线说明连接，修改参数后观察效果。', ...template });
}
templates.push(...course.templates);

function supportsBoard(template, fqbn = '') {
  return !template.boards || template.boards.includes(fqbn.split(':').slice(0, 3).join(':'));
}
function templateReadme(template, fqbn = '') {
  const source = template.source ? `${template.source.file}，第 ${template.source.pages.join('、')} 页` : '补充实验（非课件原文）';
  return `# ${template.title}\n\n${template.outcome}\n\n## 实验准备\n\n- 板型：${template.boards ? 'ESP32-S3；Arduino-ESP32 3.x（已用 3.3.12 编译验证）' : 'Arduino Uno / ESP32-S3；按板卡调整引脚'}\n- 当前选择：${fqbn || '尚未选择，请在 IDE 顶部选择实际板型'}\n- 所需库：${template.libraries.length ? template.libraries.join('、') + '（Arduino IDE → 库管理器安装）' : '仅使用开发板核心自带 API / 库'}\n- 接线：${template.parts}\n- 参数：${template.pins.join('；')}\n\n## 操作与观察\n\n1. 断电接线，核对电源、地线和引脚编号，按模块实际规格供电。\n2. 在 IDE 中选择实际开发板；安装上列依赖；修改代码顶部参数。\n3. 打开实时监测面板观察编辑中的错误；运行硬件实验仍需点击上传。\n4. ${template.outcome}\n\n## 排错\n\n- 无法编译：核对开发板、核心版本与依赖；以第一条错误为起点。\n- 无串口输出：监视器设为 115200；ESP32-S3 的 USB CDC 设置按实际连接方式选择。\n- 编译通过但器件无反应：核对共地、引脚、电平、有效高低电平与模块型号。\n${(template.notes || []).map(note => '- ' + note).join('\n')}\n\n## 来源与改编\n\n${source}。代码为独立整理实现，接线与 API 调整见上方说明；实际硬件效果仍需按你的器材验证。\n`;
}
function templateCode(template, fqbn = '') {
  const source = template.source ? `${template.source.file} 第 ${template.source.pages.join('、')} 页` : '补充实验';
  const guard = template.boards ? '#if !defined(CONFIG_IDF_TARGET_ESP32S3)\n#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"\n#endif\n#include <esp_arduino_version.h>\n#if ESP_ARDUINO_VERSION_MAJOR < 3\n#error "Please install Arduino-ESP32 3.x"\n#endif\n\n' : '';
  return `// ${template.title}\n// 接线：${template.parts}\n// 当前诊断板型：${fqbn || '未选择'}\n// 适用板型：${template.boards ? 'ESP32-S3 / Arduino-ESP32 3.x' : 'Uno / ESP32-S3（按板卡调整引脚）'}\n// 依赖库：${template.libraries.join('、') || '开发板核心自带'}\n// 来源：${source}\n// 预期现象：${template.outcome}\n// 示例引脚需要按你的板卡原理图调整；不会自动上传。\n// 可改参数：${template.pins.join('；')}\n${(template.notes || []).map(note => '// 注意：' + note + '\n').join('')}\n${guard}${template.body}`;
}
module.exports = { templates, templateCode, templateReadme, supportsBoard };
