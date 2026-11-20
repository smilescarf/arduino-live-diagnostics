'use strict';

const api = [
  ['pinMode', 'void pinMode(pin, mode)', '设置引脚模式：OUTPUT 输出、INPUT 输入、INPUT_PULLUP 内部上拉输入。', 'pinMode(${1:LED_PIN}, ${2:OUTPUT});'],
  ['digitalWrite', 'void digitalWrite(pin, value)', '设置数字输出：HIGH 为高电平，LOW 为低电平，不直接等同于开/关。应按接线及模块的有效电平选择。先用 pinMode(pin, OUTPUT) 配置；不会自动初始化引脚。', 'digitalWrite(${1:LED_PIN}, ${2|HIGH,LOW|});'],
  ['digitalRead', 'int digitalRead(pin)', '读取 HIGH 或 LOW。INPUT_PULLUP 按键接地时，按下读到 LOW。', 'digitalRead(${1:BUTTON_PIN})'],
  ['map', 'long map(value, fromLow, fromHigh, toLow, toHigh)', '将整数按比例映射。输入区间两端必须不同；结果不会自动限幅，必要时再用 constrain。', 'map(${1:raw}, ${2:0}, ${3:1023}, ${4:0}, ${5:100})'],
  ['millis', 'unsigned long millis()', '启动后的毫秒计数。用 unsigned long now - previous 比较间隔，可处理计数回绕。', 'millis()'],
  ['delay', 'void delay(ms)', '等待指定毫秒，期间当前 loop 无法继续执行；多任务实验优先考虑 millis。', 'delay(${1:500});'],
  ['analogRead', 'int analogRead(pin)', '读取 ADC。引脚、电压范围与分辨率取决于板卡；Uno 默认 0～1023，ESP32 可配置分辨率。', 'analogRead(${1:A0})'],
  ['analogWrite', 'void analogWrite(pin, value)', '输出 PWM（并非所有引脚都支持）。可用引脚及数值范围由开发板核心决定。', 'analogWrite(${1:LED_PIN}, ${2:128});'],
  ['tone', 'void tone(pin, frequency, duration)', '驱动无源蜂鸣器输出指定频率，duration 为毫秒；取决于开发板核心支持。', 'tone(${1:BUZZER_PIN}, ${2:1000}, ${3:150});'],
  ['noTone', 'void noTone(pin)', '停止 tone 产生的方波。', 'noTone(${1:BUZZER_PIN});'],
  ['constrain', 'constrain(value, low, high)', '将数值限制在上下限之间。参数尽量使用一致的数值类型。', 'constrain(${1:value}, ${2:0}, ${3:100})'],
  ['attachInterrupt', 'void attachInterrupt(interrupt, handler, mode)', '注册 GPIO 中断。使用 digitalPinToInterrupt(pin)，模式 CHANGE/RISING/FALLING；中断函数仅记录事件，避免延时和串口输出。可用中断引脚按板型确定。', 'attachInterrupt(digitalPinToInterrupt(${1:BUTTON_PIN}), ${2:onKeyEdge}, ${3:CHANGE});'],
  ['detachInterrupt', 'void detachInterrupt(interrupt)', '停止对应引脚的中断处理。', 'detachInterrupt(digitalPinToInterrupt(${1:BUTTON_PIN}));'],
  ['pulseIn', 'unsigned long pulseIn(pin, value, timeout)', '测量脉冲长度，单位微秒。同步等待直到完成或超时；返回 0 表示超时，超声波不能把它当作距离 0。', 'pulseIn(${1:ECHO_PIN}, ${2:HIGH}, ${3:25000UL})'],
  ['delayMicroseconds', 'void delayMicroseconds(us)', '阻塞等待指定微秒，适合超声波的短触发脉冲；不适合代替长时间任务调度。', 'delayMicroseconds(${1:10});'],
  ['analogReadResolution', 'void analogReadResolution(bits)', 'ESP32：设置 ADC 读数位数，课件 S3 实验使用 12 位（0～4095）；仅支持该 API 的板型可用。', 'analogReadResolution(${1:12});', 'esp32'],
  ['analogReadMilliVolts', 'uint32_t analogReadMilliVolts(pin)', 'ESP32：读取经核心校准的毫伏值；仍需遵守引脚允许电压与衰减量程，不能用 GPIO 直接测高压。', 'analogReadMilliVolts(${1:ADC_PIN})', 'esp32'],
  ['analogSetPinAttenuation', 'void analogSetPinAttenuation(pin, attenuation)', 'ESP32：设置单个 ADC 引脚衰减；ADC_11db 的实际量程由芯片决定，不代表能精确测完整 0～3.3V。', 'analogSetPinAttenuation(${1:ADC_PIN}, ${2:ADC_11db});', 'esp32'],
  ['ledcAttach', 'bool ledcAttach(pin, frequency, resolution)', 'Arduino-ESP32 3.x：给引脚分配 PWM；频率 Hz，分辨率位数。必须检查是否返回 true；旧版核心的 ledcSetup API 不能混用。', 'ledcAttach(${1:LED_PIN}, ${2:1000}, ${3:10})', 'esp32'],
  ['ledcWrite', 'bool ledcWrite(pin, duty)', 'Arduino-ESP32 3.x：按引脚更新占空比；10 位范围 0～1023，先成功 ledcAttach。', 'ledcWrite(${1:LED_PIN}, ${2:512});', 'esp32'],
  ['ledcAttachChannel', 'bool ledcAttachChannel(pin, frequency, resolution, channel)', 'Arduino-ESP32 3.x：显式指定 PWM 通道；多个引脚共享通道时占空比同步。独立音调与灯光要考虑通道对应的定时器共享。', 'ledcAttachChannel(${1:LED_PIN}, ${2:1000}, ${3:10}, ${4:0})', 'esp32'],
  ['ledcWriteChannel', 'bool ledcWriteChannel(channel, duty)', 'Arduino-ESP32 3.x：更新指定通道的占空比，影响绑定到同通道的所有引脚。', 'ledcWriteChannel(${1:0}, ${2:512});', 'esp32'],
  ['ledcWriteTone', 'uint32_t ledcWriteTone(pin, frequency)', 'Arduino-ESP32 3.x：产生 50% 占空比音调，频率为 0 时停止，适合无源蜂鸣器；先配置 LEDC 引脚。', 'ledcWriteTone(${1:BUZZER_PIN}, ${2:2000});', 'esp32'],
  ['ledcWriteNote', 'uint32_t ledcWriteNote(pin, note, octave)', 'Arduino-ESP32 3.x：按音名与八度播放音调，如 NOTE_C、4；不会自动在固定时间后停止。', 'ledcWriteNote(${1:BUZZER_PIN}, ${2:NOTE_C}, ${3:4});', 'esp32'],
  ['timerBegin', 'hw_timer_t *timerBegin(frequency)', 'Arduino-ESP32 3.x：申请硬件定时器并指定计数频率 Hz；返回 nullptr 时初始化失败。', 'timerBegin(${1:1000000})', 'esp32'],
  ['timerAttachInterrupt', 'void timerAttachInterrupt(timer, handler)', 'Arduino-ESP32 3.x：绑定硬件定时器回调；回调只做简短事件记录。', 'timerAttachInterrupt(${1:timer}, ${2:onTimer});', 'esp32'],
  ['timerAlarm', 'void timerAlarm(timer, value, autoreload, reload_count)', 'Arduino-ESP32 3.x：设置告警计数值并使能。计数频率 1MHz 时 1000000 tick 为 1 秒；autoreload=true 周期触发，reload_count=0 不限制重装次数。', 'timerAlarm(${1:timer}, ${2:1000000}, ${3:true}, ${4:0});', 'esp32']
].map(([name, signature, description, snippet, architecture]) => ({ name, signature, description, snippet, architecture }));

function availableApi(fqbn = '') {
  return api.filter(item => !item.architecture || fqbn.startsWith(item.architecture + ':'));
}

module.exports = { api, availableApi };
