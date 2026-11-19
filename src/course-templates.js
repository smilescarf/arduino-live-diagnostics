'use strict';

// Curated implementations, rather than pasted slide fragments. Each experiment
// keeps its source pages and names hardware/API assumptions explicitly.
const courses = [
  '1-2 点亮LED灯.pptx', '2-1 按键及去抖动.pptx', '3-1 millis定时机制.pptx',
  '3-2 GPIO外部中断.pptx', '4-1 通用定时器.pptx', '4-2 PWM原理及应用.pptx',
  '5-1 数模转换器.pptx', '6-1 WS2812灯带控制.pptx', '7-1 数码管显示.pptx',
  '7-2 TM1637数码管模块.pptx', '8-1 TFT-LCD显示.pptx', '8-2 超声波测距及舵机应用.pptx',
  '9-1 光电模块与霍尔传感器1.pptx', '9-2 继电器与电容式触摸按键1.pptx',
  '10-1 WIF理论与实战.pptx', '11-1 蓝牙BLE.pptx'
];
const templates = [];
function add(id, title, chapter, pages, parts, pins, outcome, body, extra = {}) {
  templates.push({ id, title, category: chapter == null ? '拓展实验' : courses[chapter].split(' ')[0],
    level: '基础', boards: ['esp32:esp32:esp32s3'], libraries: [],
    source: chapter == null ? null : { file: courses[chapter], pages },
    parts, pins, outcome, body, ...extra });
}
const button = `// 内部上拉：按键接 GPIO42 与 GND；稳定 30ms 才接受状态改变。
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
`;
const ledParts = '外接 LED 正极经 1kΩ 电阻接 GPIO41，负极接 GND。';
add('CourseLed', '01 · 点亮与闪烁 LED', 0, [7, 10], ledParts, ['LED_PIN = 41', 'INTERVAL_MS = 1000'],
  'LED 每秒切换亮灭；把 INTERVAL_MS 改成 200 比较快慢。', `const int LED_PIN = 41;
const unsigned long INTERVAL_MS = 1000;
unsigned long previous = 0;
bool on = false;
void setup() { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= INTERVAL_MS) {
    previous = now; on = !on; digitalWrite(LED_PIN, on ? HIGH : LOW);
  }
}
`, { notes: ['课件 GPIO45 改为 GPIO41，避开启动配置引脚；采用 millis，便于后续同时检测按键。'] });
add('MorseSOS', '01 · SOS 莫尔斯灯', 0, [14], ledParts, ['LED_PIN = 41', 'UNIT_MS = 150'],
  '三短、三长、三短循环；修改 UNIT_MS 改变速度。', `const int LED_PIN = 41;
const unsigned long UNIT_MS = 150;
// 亮灭时长按一个单位计算：字母间 3 单位，整组间 7 单位。
const uint8_t durationUnits[] = {1,1,1,1,1,3,3,1,3,1,3,3,1,1,1,1,1,7};
uint8_t phase = 0;
unsigned long changedAt = 0;
void setup() { pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, HIGH); }
void loop() {
  const unsigned long now = millis();
  if (now - changedAt >= UNIT_MS * durationUnits[phase]) {
    changedAt = now; phase = (phase + 1) % sizeof(durationUnits);
    digitalWrite(LED_PIN, phase % 2 == 0 ? HIGH : LOW);
  }
}
`, { notes: ['采用标准莫尔斯码的字母/组间隔；与课件整组停 1 秒的演示略有不同。'] });
add('ButtonLed', '02 · 按键消抖控灯', 1, [7, 8, 19, 24], ledParts + ' 按键接 GPIO42 和 GND，无需外部上拉。',
  ['LED_PIN = 41', 'BUTTON_PIN = 42'], '每按下一次切换亮灭；长按只切换一次。', button + `const int LED_PIN = 41;
bool on = false;
void setup() {
  pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW);
  pinMode(BUTTON_PIN, INPUT_PULLUP); Serial.begin(115200);
}
void loop() {
  if (pressed(millis())) { on = !on; digitalWrite(LED_PIN, on ? HIGH : LOW); Serial.println(on ? "亮" : "灭"); }
}
`);
add('ButtonChase', '02 · 按键切换四灯流水方向', 1, [12], '4 个 LED 分别经 1kΩ 接 GPIO38、39、40、41，负极接地；按键 GPIO42 接地。',
  ['LED_PINS = {38,39,40,41}', 'STEP_MS = 250'], '流水灯一直运行；每次按键反转方向，不中断移灯。', button + `const int LED_PINS[] = {38,39,40,41};
const unsigned long STEP_MS = 250;
unsigned long previous = 0;
int indexLed = 0, direction = 1;
void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  digitalWrite(LED_PINS[0], HIGH);
}
void loop() {
  const unsigned long now = millis();
  if (pressed(now)) direction = -direction;
  if (now - previous >= STEP_MS) {
    previous = now; digitalWrite(LED_PINS[indexLed], LOW);
    indexLed = (indexLed + direction + 4) % 4; digitalWrite(LED_PINS[indexLed], HIGH);
  }
}
`);
add('MillisTasks', '03 · millis 多任务流水灯', 2, [5, 6, 7], '3 个 LED 分别经电阻接 GPIO39、40、41，负极接地；按键 GPIO42 接地。',
  ['LED_PINS = {39,40,41}', 'STEP_MS = 500'], '移灯、每秒串口报告和按键计数同时执行；串口 115200。', button + `const int LED_PINS[] = {39,40,41};
const unsigned long STEP_MS = 500;
unsigned long lastStep = 0, lastReport = 0, count = 0;
int indexLed = 0;
void setup() {
  Serial.begin(115200); pinMode(BUTTON_PIN, INPUT_PULLUP);
  for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  digitalWrite(LED_PINS[0], HIGH);
}
void loop() {
  const unsigned long now = millis();
  if (pressed(now)) ++count;
  if (now - lastStep >= STEP_MS) {
    lastStep = now; digitalWrite(LED_PINS[indexLed], LOW);
    indexLed = (indexLed + 1) % 3; digitalWrite(LED_PINS[indexLed], HIGH);
  }
  if (now - lastReport >= 1000) { lastReport = now; Serial.printf("已按 %lu 次\\n", count); }
}
`);
add('InterruptChase', '03 · 外部中断与非阻塞流水灯', 3, [6, 7, 8, 9], 'LED39、40、41 各串电阻接地；按键 GPIO42 接地，内部上拉。',
  ['BUTTON_PIN = 42', 'STEP_MS = 250'], '按键中断记录边沿，主循环消抖并切换流水方向。', `const int LED_PINS[] = {39,40,41};
const int BUTTON_PIN = 42;
const unsigned long STEP_MS = 250;
portMUX_TYPE keyMux = portMUX_INITIALIZER_UNLOCKED;
volatile bool edgePending = false;
bool waiting = false, armed = true;
int candidate = HIGH, indexLed = 0, direction = 1;
unsigned long changedAt = 0, lastStep = 0;
void ARDUINO_ISR_ATTR onKeyEdge() {
  portENTER_CRITICAL_ISR(&keyMux); edgePending = true; portEXIT_CRITICAL_ISR(&keyMux);
}
void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); }
  digitalWrite(LED_PINS[0], HIGH);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onKeyEdge, CHANGE);
}
void loop() {
  const unsigned long now = millis();
  portENTER_CRITICAL(&keyMux); const bool edge = edgePending; edgePending = false; portEXIT_CRITICAL(&keyMux);
  const int reading = digitalRead(BUTTON_PIN);
  if (edge || reading != candidate) { candidate = reading; changedAt = now; waiting = true; }
  if (waiting && now - changedAt >= 30) {
    waiting = false;
    if (candidate == HIGH) armed = true;
    else if (armed) { armed = false; direction = -direction; }
  }
  if (now - lastStep >= STEP_MS) {
    lastStep = now; digitalWrite(LED_PINS[indexLed], LOW);
    indexLed = (indexLed + direction + 3) % 3; digitalWrite(LED_PINS[indexLed], HIGH);
  }
}
`, { level: '进阶', notes: ['中断内仅设置标志；不做串口输出、延时或消抖。'] });
add('HardwareTimer', '04 · 硬件定时器闪灯', 4, [6, 7, 8], ledParts, ['TIMER_HZ = 1000000', 'ALARM_TICKS = 1000000'],
  '硬件每秒产生一次中断；主循环处理累计事件并输出计数。', `const int LED_PIN = 41;
const uint32_t TIMER_HZ = 1000000;
const uint64_t ALARM_TICKS = 1000000;
hw_timer_t *timer = nullptr;
portMUX_TYPE timerMux = portMUX_INITIALIZER_UNLOCKED;
volatile uint32_t pendingTicks = 0;
bool on = false;
void ARDUINO_ISR_ATTR onTimer() {
  portENTER_CRITICAL_ISR(&timerMux); ++pendingTicks; portEXIT_CRITICAL_ISR(&timerMux);
}
void setup() {
  Serial.begin(115200); pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW);
  timer = timerBegin(TIMER_HZ);
  if (!timer) { Serial.println("定时器申请失败"); return; }
  timerAttachInterrupt(timer, &onTimer);
  timerAlarm(timer, ALARM_TICKS, true, 0);
}
void loop() {
  portENTER_CRITICAL(&timerMux); const uint32_t ticks = pendingTicks; pendingTicks = 0; portEXIT_CRITICAL(&timerMux);
  if (ticks) { if (ticks % 2) on = !on; digitalWrite(LED_PIN, on ? HIGH : LOW); Serial.println(ticks); }
}
`, { notes: ['使用 Arduino-ESP32 3.x timerBegin/AttachInterrupt/Alarm API。'] });
add('PwmBreathing', '04 · LEDC 呼吸灯', 5, [5, 6], ledParts, ['LED_PIN = 41', 'CYCLE_MS = 4000'],
  '2 秒渐亮、2 秒渐灭；修改周期和 PWM 分辨率观察变化。', `const int LED_PIN = 41;
const unsigned long CYCLE_MS = 4000;
bool ready = false;
unsigned long lastFrame = 0;
void setup() { Serial.begin(115200); ready = ledcAttach(LED_PIN, 1000, 10); if (!ready) Serial.println("LEDC 初始化失败"); }
void loop() {
  const unsigned long now = millis();
  if (ready && now - lastFrame >= 10) {
    lastFrame = now; const unsigned long phase = now % CYCLE_MS;
    const unsigned long ramp = phase < CYCLE_MS/2 ? phase : CYCLE_MS-phase;
    ledcWrite(LED_PIN, map(ramp, 0, CYCLE_MS/2, 0, 1023));
  }
}
`);
add('PwmScale', '04 · 无源蜂鸣器音阶与警报', 5, [8, 9, 10], '低功耗无源蜂鸣器模块信号接 GPIO4，电源按模块规格，共地；大电流器件使用驱动模块。',
  ['BUZZER_PIN = 4', 'MODE = 0（音阶）或 1（警报）'], 'MODE=0 循环 C 大调音阶；MODE=1 输出平滑升降的警报音。', `const int BUZZER_PIN = 4;
const int MODE = 0;
const note_t notes[] = {NOTE_C,NOTE_D,NOTE_E,NOTE_F,NOTE_G,NOTE_A,NOTE_B};
unsigned long previous = 0;
int noteIndex = 0;
bool ready = false;
void setup() { Serial.begin(115200); ready = ledcAttach(BUZZER_PIN, 1000, 10); if (!ready) Serial.println("蜂鸣器初始化失败"); }
void loop() {
  const unsigned long now = millis();
  if (!ready) return;
  if (MODE == 0 && now - previous >= 400) {
    previous = now;
    if (noteIndex < 7) ledcWriteNote(BUZZER_PIN, notes[noteIndex], 4); else ledcWriteTone(BUZZER_PIN, 0);
    noteIndex = (noteIndex + 1) % 9;
  } else if (MODE == 1 && now - previous >= 10) {
    previous = now; const float wave = sinf((now % 1800) * PI / 1800.0f);
    ledcWriteTone(BUZZER_PIN, 1000 + int(wave * 1000));
  }
}
`);
add('PwmSync', '04 · 双 LED 同通道同步呼吸', 5, [11], 'LED 各串 1kΩ，分别接 GPIO1、GPIO2，负极接地。',
  ['LED_A = 1', 'LED_B = 2', 'CHANNEL = 0'], '两个引脚共享一个 PWM 通道，同时渐亮渐灭。', `const int LED_A = 1, LED_B = 2, CHANNEL = 0;
bool ready = false;
unsigned long previous = 0;
void setup() {
  Serial.begin(115200);
  ready = ledcAttachChannel(LED_A, 1000, 10, CHANNEL);
  ready = ledcAttachChannel(LED_B, 1000, 10, CHANNEL) && ready;
  if (!ready) Serial.println("共享 PWM 通道初始化失败");
}
void loop() {
  const unsigned long now = millis();
  if (ready && now - previous >= 10) {
    previous = now; const unsigned long phase = now % 4000;
    ledcWriteChannel(CHANNEL, map(phase < 2000 ? phase : 4000-phase, 0, 2000, 0, 1023));
  }
}
`);
add('SoundLightAlarm', '04 · 同步声光报警器', 5, [11], ledParts + ' 无源蜂鸣器模块信号接 GPIO4，共地。',
  ['LED_PIN = 41', 'BUZZER_PIN = 4'], 'LED 亮度和音高按同一个波形变化；学习 map、sin 和独立 PWM 通道。', `const int LED_PIN = 41, BUZZER_PIN = 4;
bool ready = false;
unsigned long previous = 0;
void setup() {
  Serial.begin(115200);
  // 显式使用不同定时器所对应的通道，改变音高不影响 LED 的频率。
  ready = ledcAttachChannel(LED_PIN, 1000, 10, 0);
  ready = ledcAttachChannel(BUZZER_PIN, 2000, 10, 2) && ready;
  if (!ready) Serial.println("声光输出初始化失败");
}
void loop() {
  const unsigned long now = millis();
  if (ready && now - previous >= 10) {
    previous = now;
    const int wave = int((sinf((now % 2000) * 2*PI/2000.0f) + 1)*511.5f);
    ledcWrite(LED_PIN, wave); ledcWriteTone(BUZZER_PIN, map(wave, 0, 1023, 1000, 2000));
  }
}
`);

const adcSetup = 'analogReadResolution(12); analogSetPinAttenuation(ADC_PIN, ADC_11db);';
add('AdcVoltage', '05 · 电位器与校准电压读取', 6, [7, 9], '电位器两端接 3.3V 与 GND，中间滑动端接 GPIO1；不得超过芯片输入额定电压。',
  ['ADC_PIN = 1', 'INTERVAL_MS = 200'], '串口同时输出原始值和校准毫伏值；不会把 ADC 读数误当精确的 0～3.3V 线性关系。', `const int ADC_PIN = 1;
const unsigned long INTERVAL_MS = 200;
unsigned long previous = 0;
void setup() { Serial.begin(115200); ${adcSetup} }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= INTERVAL_MS) { previous = now; Serial.printf("raw=%d, mV=%lu\\n", analogRead(ADC_PIN), (unsigned long)analogReadMilliVolts(ADC_PIN)); }
}
`);
add('LightSensor', '05 · 光敏电阻感光灯（带回差）', 6, [10], '3.3V → 光敏电阻 → GPIO1 测量点 → 10kΩ → GND；LED41 经电阻接地。',
  ['ADC_PIN = 1', 'DARK_ON = 1000', 'BRIGHT_OFF = 1400'], '较暗时点亮，较亮时熄灭；两阈值避免临界点反复闪烁。先看串口再校准阈值。', `const int ADC_PIN = 1, LED_PIN = 41;
const int DARK_ON = 1000, BRIGHT_OFF = 1400;
unsigned long previous = 0;
bool on = false;
void setup() { Serial.begin(115200); pinMode(LED_PIN, OUTPUT); digitalWrite(LED_PIN, LOW); ${adcSetup} }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= 100) {
    previous = now; const int raw = analogRead(ADC_PIN);
    if (raw < DARK_ON) on = true; else if (raw > BRIGHT_OFF) on = false;
    digitalWrite(LED_PIN, on ? HIGH : LOW); Serial.println(raw);
  }
}
`);
add('VoltageBar', '05 · 八灯电压进度条', 6, [11], '电位器中间脚接 GPIO1；8 个 LED 分别经 1kΩ 接 GPIO4～11，负极接地。',
  ['ADC_PIN = 1', 'LED_PINS = {4,5,6,7,8,9,10,11}'], '电位器由低到高时点亮 0～8 个 LED。', `const int ADC_PIN = 1;
const int LED_PINS[] = {4,5,6,7,8,9,10,11};
unsigned long previous = 0;
void setup() { ${adcSetup} for (int pin : LED_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, LOW); } }
void loop() {
  const unsigned long now = millis();
  if (now - previous >= 50) {
    previous = now; const int count = constrain(map(analogRead(ADC_PIN), 0, 4095, 0, 8), 0L, 8L);
    for (int i = 0; i < 8; ++i) digitalWrite(LED_PINS[i], i < count ? HIGH : LOW);
  }
}
`, { notes: ['避开部分 S3 模组被 Flash/PSRAM 占用的 GPIO35～37，改用 GPIO4～11。'] });
add('Ws2812Effects', '06 · WS2812 六种灯效与往返彗星', 7, [15,16,17,18,19,20],
  '8 灯 WS2812 数据接 GPIO7（串 330Ω），共地；供电按灯带规格，5V 灯带用外部电源和合适的 3.3V→5V 数据电平转换。勿由 GPIO 供电。',
  ['DATA_PIN = 7', 'NUM_LEDS = 8', 'EFFECT = 0～5', 'BRIGHTNESS = 32'],
  'EFFECT：0三色轮换、1彩虹、2彗星、3往返彗星、4呼吸、5随机闪烁。', `#include <FastLED.h>
const uint8_t DATA_PIN = 7;
const int NUM_LEDS = 8;
const int EFFECT = 3;
const uint8_t BRIGHTNESS = 32;
CRGB leds[NUM_LEDS];
unsigned long previous = 0;
uint8_t hue = 0;
unsigned long frame = 0;
void setup() { FastLED.addLeds<WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS); FastLED.setBrightness(BRIGHTNESS); FastLED.clear(true); }
void loop() {
  const unsigned long now = millis();
  if (now - previous < 40) return;
  previous = now; ++frame; ++hue;
  switch (EFFECT) {
    case 0: { const CRGB colors[] = {CRGB::Red, CRGB::Green, CRGB::Blue}; fill_solid(leds, NUM_LEDS, colors[(now/1000)%3]); break; }
    case 1: fill_rainbow(leds, NUM_LEDS, hue, 32); break;
    case 2: fadeToBlackBy(leds, NUM_LEDS, 80); leds[(frame/3)%NUM_LEDS] = CHSV(hue,255,255); break;
    case 3: {
      fadeToBlackBy(leds, NUM_LEDS, 40);
      // 上界必须是 NUM_LEDS-1，避免课件示意代码的越界。
      const int pos = map(triwave8(beat8(30)), 0,255, 0,NUM_LEDS-1);
      leds[pos] = CHSV(hue,255,255); break;
    }
    case 4: fill_solid(leds, NUM_LEDS, CHSV(hue,255,sin8(hue))); break;
    case 5: FastLED.clear(false); leds[random(NUM_LEDS)] = CHSV(random(256),255,255); break;
    default: FastLED.clear(false); break;
  }
  FastLED.show(); // 刷新仍有实际传输耗时；不承诺所有库版本均为异步 DMA。
}
`, { libraries: ['FastLED'], notes: ['默认亮度降低；课件中的 FastLtED、voidsetup、尾随 ar 拼写错误已修正。'] });

const segments = `// a,b,c,d,e,f,g,dp 各串 1kΩ；以下为共阴段码。
const int SEG_PINS[] = {4,5,6,7,8,9,10,11};
const uint8_t DIGITS[] = {0x3f,0x06,0x5b,0x4f,0x66,0x6d,0x7d,0x07,0x7f,0x6f};
const bool COMMON_ANODE = false;
void writeSegments(int number) {
  const uint8_t mask = DIGITS[number % 10];
  for (int i=0; i<8; ++i) {
    const bool lit = (mask >> i) & 1;
    digitalWrite(SEG_PINS[i], lit != COMMON_ANODE ? HIGH : LOW);
  }
}
`;
const segmentNotes = ['课件 GPIO35～42 改为 GPIO4～11，避开部分 S3 模组的存储器引脚；按段名接线，不能只看外壳脚号。'];
add('SevenSegment', '07 · 单位数码管 0～9', 8, [3,4,5], '共阴数码管公共阴极接地；a,b,c,d,e,f,g,dp 分别经 1kΩ 接 GPIO4～11。共阳管需改 COMMON_ANODE 并接 3.3V。',
  ['SEG_PINS = {4,5,6,7,8,9,10,11}', 'COMMON_ANODE = false'], '每秒显示下一个数字；学习段码与数组。', segments + `unsigned long previous = 0;
int value = 0;
void setup() { for (int pin : SEG_PINS) pinMode(pin, OUTPUT); writeSegments(0); }
void loop() { const unsigned long now = millis(); if (now-previous >= 1000) { previous=now; value=(value+1)%10; writeSegments(value); } }
`, { notes: segmentNotes });
add('MultiplexCounter', '07 · 两位数码管动态扫描计数', 8, [6,7,8],
  '共阴两位数码管 a～dp 经各自 1kΩ 接 GPIO4～11；两位公共阴极分别经 NPN/驱动器接地，驱动输入接 GPIO12、13（基极串电阻），不要让 GPIO 直接承担整位电流。',
  ['DIGIT_PINS = {12,13}', 'DIGIT_ON = HIGH'], '每 2ms 扫描一位，00～99 每秒加一；切位前先关闭两位防重影。', segments + `const int DIGIT_PINS[] = {12,13};
const int DIGIT_ON = HIGH; // NPN 低侧驱动，高电平使能；按驱动电路修改。
unsigned long lastScan=0, lastCount=0;
int activeDigit=0, value=0;
void setup() {
  for (int pin : SEG_PINS) pinMode(pin, OUTPUT);
  for (int pin : DIGIT_PINS) { pinMode(pin, OUTPUT); digitalWrite(pin, !DIGIT_ON); }
}
void loop() {
  const unsigned long now=millis();
  if (now-lastCount>=1000) { lastCount=now; value=(value+1)%100; }
  if (now-lastScan>=2) {
    lastScan=now;
    for (int pin : DIGIT_PINS) digitalWrite(pin, !DIGIT_ON);
    activeDigit=1-activeDigit; writeSegments(activeDigit==0 ? value/10 : value%10);
    digitalWrite(DIGIT_PINS[activeDigit], DIGIT_ON);
  }
}
`, { level: '进阶', notes: segmentNotes });
const tm = `#include <TM1637Display.h>
const int CLK_PIN=48, DIO_PIN=47;
TM1637Display display(CLK_PIN,DIO_PIN);
`;
const tmParts = 'TM1637：CLK→GPIO48，DIO→GPIO47，GND→GND，使用支持 3.3V 供电/逻辑的模块。GPIO48 若被板载 RGB LED 占用请换脚。';
add('Tm1637Demo', '07 · TM1637 常用显示 API', 9, [3,4,5], tmParts, ['CLK_PIN = 48', 'DIO_PIN = 47'],
  '依次显示数字、负数、冒号和横杠。小数点/冒号形状由模块硬件决定。', tm + `unsigned long previous=0;
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
`, { libraries:['TM1637'] });
add('TmStopwatch', '07 · TM1637 分秒计时', 9, [6], tmParts, ['CLK_PIN = 48', 'DIO_PIN = 47'],
  '从 00:00 到 59:59 循环；每秒更新，保留前导零。', tm + `unsigned long previous=0;
unsigned int seconds=0;
void setup() { display.setBrightness(4); display.showNumberDecEx(0,0x40,true); }
void loop() {
  const unsigned long now=millis();
  if (now-previous>=1000) {
    const unsigned long elapsed=(now-previous)/1000; previous+=elapsed*1000;
    seconds=(seconds+elapsed)%3600; display.showNumberDecEx((seconds/60)*100+seconds%60,0x40,true);
  }
}
`, { libraries:['TM1637'] });
add('TmCountdown', '07 · 60 秒倒计时与结束闪烁', 9, [7], tmParts + ' 可选：按键 GPIO42 接地以重新计时；板上的复位键同样会重新开始。',
  ['START_SECONDS = 60', 'BUTTON_PIN = 42'], '倒数到 0 停止并闪烁；按键消抖后重新开始。', tm + button + `const int START_SECONDS=60;
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
`, { libraries:['TM1637'] });

const lcd = `#include <LovyanGFX.hpp>
class CourseDisplay : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789 panel;
  lgfx::Bus_SPI bus;
public:
  CourseDisplay() {
    auto cfg=bus.config();
    cfg.spi_host=SPI2_HOST; cfg.spi_mode=0; cfg.freq_write=40000000; cfg.freq_read=16000000;
    cfg.spi_3wire=true; cfg.use_lock=true; cfg.dma_channel=SPI_DMA_CH_AUTO;
    cfg.pin_sclk=12; cfg.pin_mosi=11; cfg.pin_miso=-1; cfg.pin_dc=14;
    bus.config(cfg); panel.setBus(&bus);
    auto p=panel.config(); p.pin_cs=10; p.pin_rst=4;
    p.panel_width=240; p.panel_height=320; p.offset_x=0; p.offset_y=0;
    p.invert=false; p.rgb_order=false; panel.config(p); setPanel(&panel);
  }
};
CourseDisplay lcd;
`;
const lcdParts='240×320 ST7789：3.3V、GND、SCK12、MOSI11、DC14、CS10、RST4；背光按模块额定电流供电，勿由普通 GPIO 直接供大电流。';
const lcdNotes=['默认 SPI 40MHz、mode0，与课件示例一致选择 mode0 并降低频率；花屏先查接线和模块规格，再调速率、偏移与反色。'];
add('TftDrawing', '08 · ST7789 图形与文字', 10, [9,10], lcdParts,
  ['SCK=12 MOSI=11 DC=14 CS=10 RST=4', 'panel_width=240 panel_height=320'],
  '显示文字、圆和直线；每秒在底部更新计数。', lcd + `unsigned long previous=0;
unsigned long counter=0;
void setup() {
  lcd.init(); lcd.setRotation(0); lcd.fillScreen(TFT_BLACK);
  lcd.setTextColor(TFT_WHITE,TFT_BLACK); lcd.setTextSize(2); lcd.setCursor(10,10); lcd.print("Hello ESP32-S3");
  lcd.drawCircle(120,140,30,TFT_RED); lcd.fillCircle(120,140,20,TFT_BLUE); lcd.drawLine(10,200,230,200,TFT_YELLOW);
}
void loop() { const unsigned long now=millis(); if (now-previous>=1000) { previous=now; lcd.fillRect(10,240,220,30,TFT_BLACK); lcd.setCursor(10,240); lcd.print(++counter); } }
`, { libraries:['LovyanGFX'], notes:lcdNotes });
add('TftSineWave', '08 · ST7789 滚动正弦波', 10, [11], lcdParts,
  ['FRAME_MS = 30', 'AMPLITUDE = 80'], '横屏绘制滚动波形，仅擦除旧曲线；数组在首帧之前初始化。', lcd + `const unsigned long FRAME_MS=30;
const int WIDTH=320, CENTER=120, AMPLITUDE=80;
int prevY[WIDTH];
float phase=0;
unsigned long previous=0;
void setup() {
  lcd.init(); lcd.setRotation(1); lcd.fillScreen(TFT_BLACK);
  for (int x=0; x<WIDTH; ++x) prevY[x]=CENTER;
}
void loop() {
  const unsigned long now=millis(); if (now-previous<FRAME_MS) return; previous=now; phase+=0.15f;
  lcd.startWrite();
  for (int x=1; x<WIDTH; ++x) lcd.drawLine(x-1,prevY[x-1],x,prevY[x],TFT_BLACK);
  lcd.drawFastHLine(0,CENTER,WIDTH,TFT_DARKGREY);
  int y=CENTER+int(AMPLITUDE*sinf(phase)); prevY[0]=y;
  for (int x=1; x<WIDTH; ++x) {
    const int next=CENTER+int(AMPLITUDE*sinf(x*0.05f+phase));
    lcd.drawLine(x-1,y,x,next,TFT_CYAN); prevY[x]=next; y=next;
  }
  lcd.endWrite();
}
`, { libraries:['LovyanGFX'], notes:lcdNotes, level:'进阶' });

const ultrasonic = `const int TRIG_PIN=5, ECHO_PIN=6;
float distanceCm() {
  digitalWrite(TRIG_PIN,LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN,HIGH); delayMicroseconds(10); digitalWrite(TRIG_PIN,LOW);
  const unsigned long duration=pulseIn(ECHO_PIN,HIGH,25000UL);
  return duration ? duration*0.0343f/2.0f : -1.0f; // 超时不能当作 0cm
}
`;
const ultrasonicParts='超声波 Trig→GPIO5、Echo→GPIO6，共地。按模块规格供电；5V Echo 必须经过分压/电平转换到 ESP32 允许的电平。';
add('UltrasonicDistance', '08 · 超声波测距与超时处理', 11, [3,4], ultrasonicParts,
  ['TRIG_PIN = 5', 'ECHO_PIN = 6', 'TIMEOUT_US = 25000'], '串口每 200ms 显示距离；无回波显示“超时”，最长等待 25ms。', ultrasonic + `unsigned long previous=0;
void setup() { Serial.begin(115200); pinMode(TRIG_PIN,OUTPUT); digitalWrite(TRIG_PIN,LOW); pinMode(ECHO_PIN,INPUT); }
void loop() {
  const unsigned long now=millis(); if (now-previous<200) return; previous=now;
  const float cm=distanceCm(); if (cm<0) Serial.println("无回波/超时"); else Serial.printf("%.1f cm\\n",cm);
}
`, { notes:['pulseIn 是有界阻塞调用（最多 25ms），不是后台异步测距。'] });
add('ServoSweep', '08 · 舵机限幅往返', 11, [6,7], '舵机信号 GPIO4；舵机使用独立的合适 5V 电源并与 ESP32 共地，不由 3.3V 引脚供电。',
  ['SERVO_PIN = 4', 'MIN_ANGLE=30 MAX_ANGLE=150', 'PULSE_US=600～2400'], '在安全角度内缓慢往返；先查舵机规格再改脉宽和角度，避免顶死。', `#include <ESP32Servo.h>
const int SERVO_PIN=4, MIN_ANGLE=30, MAX_ANGLE=150;
Servo arm;
int angle=MIN_ANGLE, direction=1;
unsigned long previous=0;
void setup() { arm.setPeriodHertz(50); arm.attach(SERVO_PIN,600,2400); arm.write(angle); }
void loop() {
  const unsigned long now=millis(); if (now-previous<30) return; previous=now;
  angle+=direction; if (angle>=MAX_ANGLE || angle<=MIN_ANGLE) direction=-direction;
  arm.write(angle);
}
`, { libraries:['ESP32Servo'] });
add('UltrasonicRadar', '08 · 舵机超声波雷达与近距报警', 11, [8], ultrasonicParts + ' 舵机信号4、独立5V供电且共地；LED41 串电阻接地。',
  ['SERVO_PIN = 4', 'SCAN=30～150°', 'ALARM_CM = 20'], '每次舵机移动后等待稳定，再输出角度/距离；近于 20cm 点亮 LED。', `#include <ESP32Servo.h>
` + ultrasonic + `const int SERVO_PIN=4, LED_PIN=41;
const float ALARM_CM=20;
Servo arm;
int angle=30, direction=5;
unsigned long movedAt=0;
void setup() {
  Serial.begin(115200); pinMode(TRIG_PIN,OUTPUT); digitalWrite(TRIG_PIN,LOW); pinMode(ECHO_PIN,INPUT);
  pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW);
  arm.setPeriodHertz(50); arm.attach(SERVO_PIN,600,2400); arm.write(angle); movedAt=millis();
}
void loop() {
  const unsigned long now=millis(); if (now-movedAt<150) return;
  const float cm=distanceCm(); Serial.printf("angle=%d,cm=%.1f\\n",angle,cm);
  digitalWrite(LED_PIN,cm>=0 && cm<ALARM_CM ? HIGH : LOW);
  if (angle>=150) direction=-5; else if (angle<=30) direction=5;
  angle+=direction; arm.write(angle); movedAt=millis();
}
`, { libraries:['ESP32Servo'], level:'综合', notes:['串口输出 cm=-1 表示超时；pulseIn 最长阻塞 25ms。'] });
add('TouchRelay', '09 · 电容触摸切换继电器', 13, [3,6,7],
  'TTP223 用 3.3V 兼容逻辑供电，OUT→GPIO7；继电器驱动模块 IN→GPIO8，按模块规格独立供电并共地。触点仅接低压 LED/小负载，先用指示灯测试。',
  ['TOUCH_PIN = 7', 'RELAY_PIN = 8', 'RELAY_ACTIVE_LEVEL = HIGH'],
  '触摸一次翻转开关，持续触摸不重复触发；上电默认关闭。模块须为点动模式。', `const int TOUCH_PIN=7, RELAY_PIN=8;
const int RELAY_ACTIVE_LEVEL=HIGH;
int raw=LOW, stable=LOW;
unsigned long changedAt=0;
bool on=false;
void setup() {
  digitalWrite(RELAY_PIN,!RELAY_ACTIVE_LEVEL); pinMode(RELAY_PIN,OUTPUT); pinMode(TOUCH_PIN,INPUT);
  raw=stable=digitalRead(TOUCH_PIN);
}
void loop() {
  const unsigned long now=millis(); const int reading=digitalRead(TOUCH_PIN);
  if (reading!=raw) { raw=reading; changedAt=now; }
  if (reading!=stable && now-changedAt>=30) {
    stable=reading; if (stable==HIGH) { on=!on; digitalWrite(RELAY_PIN,on ? RELAY_ACTIVE_LEVEL : !RELAY_ACTIVE_LEVEL); }
  }
}
`, { notes:['低电平触发继电器请改 RELAY_ACTIVE_LEVEL；上电复位期间硬件也应保持关闭，软件不能替代驱动电路设计。'] });

module.exports = { courses, templates, add };
