// 11 · 三按键 BLE 复制粘贴剪切键盘
// 接线：3 个按键分别接 GPIO39、40、41 与 GND；内部上拉。通过电脑系统蓝牙设置配对 ArduinoLab-Keys。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：11-1 蓝牙BLE.pptx 第 14 页
// 预期现象：只在实体按键按下后发送 Ctrl+C、Ctrl+V、Ctrl+X，并自动松开；先在空白文本编辑器中测试。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：KEY_PINS = {39,40,41}；CTRL_MODIFIER = 0x01（Windows/Linux）
// 注意：使用 ESP32 核心内置 BLEHIDDevice 实现同一作业，避免旧版 ESP32-BLE-Keyboard 的核心兼容问题；支持配对的主机系统仍须实机验证。更改报告后系统可能需要删除旧配对再连接。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLE2902.h>
#include <atomic>
const char *SERVICE_UUID="4fafc201-1fb5-459e-8fcc-c5c9c331914b";
std::atomic<bool> connected{false}, restartAdvertising{false};
class ConnectionCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { connected.store(true); }
  void onDisconnect(BLEServer*) override { connected.store(false); restartAdvertising.store(true); }
};
void pollAdvertising() {
  static bool waiting=false;
  static unsigned long disconnectedAt=0;
  if (restartAdvertising.exchange(false)) { waiting=true; disconnectedAt=millis(); }
  if (waiting && millis()-disconnectedAt>=500) { waiting=false; if (!connected.load()) BLEDevice::startAdvertising(); }
}
#include <BLEHIDDevice.h>
#include <BLESecurity.h>
const int KEY_PINS[]={39,40,41};
const uint8_t KEY_USAGES[]={0x06,0x19,0x1b}; // HID C、V、X
const uint8_t CTRL_MODIFIER=0x01; // macOS 可改左 Command=0x08
// 标准键盘输入报告：修饰键1字节、保留1字节、6个键码。
uint8_t reportMap[]={
  0x05,0x01,0x09,0x06,0xA1,0x01,0x85,0x01,
  0x05,0x07,0x19,0xE0,0x29,0xE7,0x15,0x00,0x25,0x01,0x75,0x01,0x95,0x08,0x81,0x02,
  0x95,0x01,0x75,0x08,0x81,0x01,
  0x95,0x06,0x75,0x08,0x15,0x00,0x25,0x65,0x05,0x07,0x19,0x00,0x29,0x65,0x81,0x00,0xC0
};
BLEHIDDevice *hid=nullptr;
BLECharacteristic *input=nullptr;
int rawKeys[]={HIGH,HIGH,HIGH}, stableKeys[]={HIGH,HIGH,HIGH};
unsigned long changedAt[]={0,0,0}, sentAt=0;
bool releasePending=false;
void setup() {
  for (int pin:KEY_PINS) pinMode(pin,INPUT_PULLUP);
  BLEDevice::init("ArduinoLab-Keys"); BLEServer *server=BLEDevice::createServer(); server->setCallbacks(new ConnectionCallbacks());
  hid=new BLEHIDDevice(server); input=hid->inputReport(1);
  hid->manufacturer("Arduino Learning Lab"); hid->hidInfo(0,1); hid->reportMap(reportMap,sizeof(reportMap)); hid->startServices();
  BLESecurity::setAuthenticationMode(ESP_LE_AUTH_BOND);
  BLESecurity::setCapability(ESP_IO_CAP_NONE);
  BLEAdvertising *advertising=BLEDevice::getAdvertising(); advertising->setAppearance(0x03c1);
  advertising->addServiceUUID(hid->hidService()->getUUID()); BLEDevice::startAdvertising();
}
void loop() {
  pollAdvertising(); const unsigned long now=millis();
  if (releasePending && (!connected.load() || now-sentAt>=20)) {
    uint8_t empty[8]={}; input->setValue(empty,sizeof(empty)); if (connected.load()) input->notify(); releasePending=false;
  }
  for (int i=0;i<3;++i) {
    const int value=digitalRead(KEY_PINS[i]);
    if (value!=rawKeys[i]) { rawKeys[i]=value; changedAt[i]=now; }
    if (value!=stableKeys[i] && now-changedAt[i]>=30) {
      stableKeys[i]=value;
      if (value==LOW && connected.load() && !releasePending) {
        uint8_t report[8]={CTRL_MODIFIER,0,KEY_USAGES[i],0,0,0,0,0}; input->setValue(report,sizeof(report)); input->notify(); sentAt=now; releasePending=true;
      }
    }
  }
}
