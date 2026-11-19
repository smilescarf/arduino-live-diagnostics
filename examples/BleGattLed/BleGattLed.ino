// 11 · GATT 控灯与传感器通知
// 接线：LED41 经电阻接地；可选电位器中间脚接 GPIO1，两端 3.3V/GND；手机使用 BLE 调试工具。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：11-1 蓝牙BLE.pptx 第 10、11、12 页
// 预期现象：向 LED 特征写入文本 1/0 控灯；订阅传感器特征后每 2 秒收到 ADC 原始值；READ 也能读取。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：LED_PIN = 41；ADC_PIN = 1；SENSOR_UUID / LED_UUID
// 注意：写入格式为 UTF-8/文本字符 1 或 0（十六进制 31/30），不是二进制 01/00；先订阅通知。全部使用自定义 128 位 UUID。

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
const char *LED_UUID="4fafc202-1fb5-459e-8fcc-c5c9c331914b";
const char *SENSOR_UUID="4fafc203-1fb5-459e-8fcc-c5c9c331914b";
const int LED_PIN=41, ADC_PIN=1;
std::atomic<int> requestedLed{-1};
BLECharacteristic *sensor=nullptr;
unsigned long previous=0;
class LedCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const String value=characteristic->getValue();
    if (value=="0" || value=="1") requestedLed.store(value=="1" ? 1 : 0);
  }
};
void setup() {
  pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW); analogReadResolution(12);
  BLEDevice::init("ArduinoLab-GATT"); BLEServer *server=BLEDevice::createServer(); server->setCallbacks(new ConnectionCallbacks());
  BLEService *service=server->createService(SERVICE_UUID);
  BLECharacteristic *led=service->createCharacteristic(LED_UUID,BLECharacteristic::PROPERTY_WRITE);
  led->setCallbacks(new LedCallbacks());
  sensor=service->createCharacteristic(SENSOR_UUID,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  sensor->addDescriptor(new BLE2902()); sensor->setValue("0"); service->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID); BLEDevice::startAdvertising();
}
void loop() {
  pollAdvertising(); const int value=requestedLed.exchange(-1); if (value>=0) digitalWrite(LED_PIN,value ? HIGH : LOW);
  const unsigned long now=millis();
  if (now-previous>=2000) { previous=now; sensor->setValue(String(analogRead(ADC_PIN))); if (connected.load()) sensor->notify(); }
}
