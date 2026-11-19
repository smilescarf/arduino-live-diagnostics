// 11 · BLE 广播、连接与重连
// 接线：ESP32-S3 与手机 BLE 调试工具（例如 nRF Connect）；无需外部器件。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：11-1 蓝牙BLE.pptx 第 9 页
// 预期现象：手机扫描到设备并连接；串口显示状态变化；断开后重新广播。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：DEVICE_NAME = ArduinoLab-BLE；SERVICE_UUID

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
void setup() {
  Serial.begin(115200); BLEDevice::init("ArduinoLab-BLE");
  BLEServer *server=BLEDevice::createServer(); server->setCallbacks(new ConnectionCallbacks());
  BLEService *service=server->createService(SERVICE_UUID); service->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID); BLEDevice::startAdvertising();
}
void loop() {
  pollAdvertising(); static bool previous=false;
  const bool current=connected.load(); if (current!=previous) { previous=current; Serial.println(current ? "手机已连接" : "手机已断开"); }
}
