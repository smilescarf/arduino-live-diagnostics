# 实验模板索引

共 42 个模板。命令面板运行 **Arduino Live: 实验模板**，支持按课次、器件、库、实验名称搜索。每个工程同时生成 .ino 与中文 README；仓库 examples 是相同源码的可直接打开副本。

课件模板针对 ESP32-S3 / Arduino-ESP32 3.x，通用入门模板另支持 Uno。核心 3.3.12 编译验证与接线实测是不同层次，编译通过不代表已经实测你的模块。

| 工程 | 实验 | 来源 | 外部库 |
| --- | --- | --- | --- |
| LedBlink | LED 闪烁（非阻塞） | 补充实验 | 核心自带 |
| LedChase | LED 流水灯 | 补充实验 | 核心自带 |
| Buzzer | 无源蜂鸣器提示音 | 补充实验 | 核心自带 |
| ButtonDebounce | 按键消抖与按下计数 | 补充实验 | 核心自带 |
| MapInput | 模拟输入与 map 数值映射 | 补充实验 | 核心自带 |
| CourseLed | 01 · 点亮与闪烁 LED | 1-2 点亮LED灯.pptx p.7,10 | 核心自带 |
| MorseSOS | 01 · SOS 莫尔斯灯 | 1-2 点亮LED灯.pptx p.14 | 核心自带 |
| ButtonLed | 02 · 按键消抖控灯 | 2-1 按键及去抖动.pptx p.7,8,19,24 | 核心自带 |
| ButtonChase | 02 · 按键切换四灯流水方向 | 2-1 按键及去抖动.pptx p.12 | 核心自带 |
| MillisTasks | 03 · millis 多任务流水灯 | 3-1 millis定时机制.pptx p.5,6,7 | 核心自带 |
| InterruptChase | 03 · 外部中断与非阻塞流水灯 | 3-2 GPIO外部中断.pptx p.6,7,8,9 | 核心自带 |
| HardwareTimer | 04 · 硬件定时器闪灯 | 4-1 通用定时器.pptx p.6,7,8 | 核心自带 |
| PwmBreathing | 04 · LEDC 呼吸灯 | 4-2 PWM原理及应用.pptx p.5,6 | 核心自带 |
| PwmScale | 04 · 无源蜂鸣器音阶与警报 | 4-2 PWM原理及应用.pptx p.8,9,10 | 核心自带 |
| PwmSync | 04 · 双 LED 同通道同步呼吸 | 4-2 PWM原理及应用.pptx p.11 | 核心自带 |
| SoundLightAlarm | 04 · 同步声光报警器 | 4-2 PWM原理及应用.pptx p.11 | 核心自带 |
| AdcVoltage | 05 · 电位器与校准电压读取 | 5-1 数模转换器.pptx p.7,9 | 核心自带 |
| LightSensor | 05 · 光敏电阻感光灯（带回差） | 5-1 数模转换器.pptx p.10 | 核心自带 |
| VoltageBar | 05 · 八灯电压进度条 | 5-1 数模转换器.pptx p.11 | 核心自带 |
| Ws2812Effects | 06 · WS2812 六种灯效与往返彗星 | 6-1 WS2812灯带控制.pptx p.15,16,17,18,19,20 | FastLED |
| SevenSegment | 07 · 单位数码管 0～9 | 7-1 数码管显示.pptx p.3,4,5 | 核心自带 |
| MultiplexCounter | 07 · 两位数码管动态扫描计数 | 7-1 数码管显示.pptx p.6,7,8 | 核心自带 |
| Tm1637Demo | 07 · TM1637 常用显示 API | 7-2 TM1637数码管模块.pptx p.3,4,5 | TM1637 |
| TmStopwatch | 07 · TM1637 分秒计时 | 7-2 TM1637数码管模块.pptx p.6 | TM1637 |
| TmCountdown | 07 · 60 秒倒计时与结束闪烁 | 7-2 TM1637数码管模块.pptx p.7 | TM1637 |
| TftDrawing | 08 · ST7789 图形与文字 | 8-1 TFT-LCD显示.pptx p.9,10 | LovyanGFX |
| TftSineWave | 08 · ST7789 滚动正弦波 | 8-1 TFT-LCD显示.pptx p.11 | LovyanGFX |
| UltrasonicDistance | 08 · 超声波测距与超时处理 | 8-2 超声波测距及舵机应用.pptx p.3,4 | 核心自带 |
| ServoSweep | 08 · 舵机限幅往返 | 8-2 超声波测距及舵机应用.pptx p.6,7 | ESP32Servo |
| UltrasonicRadar | 08 · 舵机超声波雷达与近距报警 | 8-2 超声波测距及舵机应用.pptx p.8 | ESP32Servo |
| TouchRelay | 09 · 电容触摸切换继电器 | 9-2 继电器与电容式触摸按键1.pptx p.3,6,7 | 核心自带 |
| WifiScanConnect | 10 · Wi-Fi 扫描与限时入网 | 10-1 WIF理论与实战.pptx p.12,13 | 核心自带 |
| WifiTcpLed | 10 · TCP 按行指令控灯 | 10-1 WIF理论与实战.pptx p.14,15,16,17 | 核心自带 |
| WifiWebLed | 10 · 网页控灯与 JSON 局部刷新 | 10-1 WIF理论与实战.pptx p.18,19,20 | 核心自带 |
| EspNowChat | 10 · ESP-NOW 双板广播与状态收发 | 10-1 WIF理论与实战.pptx p.21,22 | 核心自带 |
| OfflineControlHub | 10 · 热点网页与 ESP-NOW 离线中枢 | 10-1 WIF理论与实战.pptx p.23 | 核心自带 |
| BleConnect | 11 · BLE 广播、连接与重连 | 11-1 蓝牙BLE.pptx p.9 | 核心自带 |
| BleGattLed | 11 · GATT 控灯与传感器通知 | 11-1 蓝牙BLE.pptx p.10,11,12 | 核心自带 |
| BleShortcutKeyboard | 11 · 三按键 BLE 复制粘贴剪切键盘 | 11-1 蓝牙BLE.pptx p.14 | 核心自带 |
| DigitalSensorCounter | 拓展 · 光电/数字霍尔去抖计数 | 补充实验 | 核心自带 |
| TrafficLights | 拓展 · 红绿灯状态机 | 补充实验 | 核心自带 |
| SerialLedConsole | 拓展 · 串口指令调试台 | 补充实验 | 核心自带 |

## 课件核对与适配

- 共 16 份 PPTX；9-1 光电模块与霍尔传感器1.pptx 的实际文字与 8-2 超声波测距及舵机应用.pptx 重复，因此光电/霍尔以 DigitalSensorCounter 补充实验实现，未虚构课件页码。
- 理论页不逐页转换为工程；课件中明确示范的实验与作业按上表提供可独立编译的实现。Wi-Fi 概览中提及的天气服务/WebSocket、BLE 概览中的中心设备/iBeacon 是后续拓展方向，本版未声称已经实现。
- WS2812 六种灯效通过 EFFECT 参数切换；音阶与警报通过 MODE 切换。
- GPIO35～37 在部分 S3 模组连接 Flash/PSRAM；数码管与电压条默认改为 GPIO4～11，逐实验 README 有说明。
- 修正课件示意代码的拼写/括号/数组上界问题；中断与无线回调只传递事件，主循环处理耗时操作；计时采用无符号差值。
- 超声波 pulseIn 最长等待 25ms；FastLED.show 和同步 WebServer 也有处理耗时，本版不把它们描述成完全异步。
- TFT 使用课件推荐 LovyanGFX；BLE 键盘采用核心内置 BLEHIDDevice，适配当前核心版本，免额外安装旧键盘库。
- 外接模块按实际额定电压供电；ESP32 输入不可直接接 5V Echo，舵机独立供电且共地，继电器模板仅演示低压负载。
- 原课件保留在本地，不打入 VSIX 或 GitHub 源码；避免数百 MB 的教学素材拖大插件。
