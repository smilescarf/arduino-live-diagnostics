// 10 · ESP-NOW 双板广播与状态收发
// 接线：两块 ESP32-S3 烧录同一代码；各接 LED41（串电阻）和 USB 串口。无需路由器。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：10-1 WIF理论与实战.pptx 第 21、22 页
// 预期现象：每 2 秒广播计数和状态；收到后闪灯并打印发送者 MAC。双方须使用相同协议与信道。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：RADIO_CHANNEL = 6；SEND_INTERVAL_MS = 2000
// 注意：固定长度实验协议，不保证每包送达；收到多包时保留最新一包。广播未加密，勿传输敏感信息。

#if !defined(CONFIG_IDF_TARGET_ESP32S3)
#error "This course template requires ESP32-S3 and Arduino-ESP32 3.x"
#endif
#include <esp_arduino_version.h>
#if ESP_ARDUINO_VERSION_MAJOR < 3
#error "Please install Arduino-ESP32 3.x"
#endif

#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <atomic>
const uint8_t RADIO_CHANNEL=6;
const uint8_t BROADCAST[]={0xff,0xff,0xff,0xff,0xff,0xff};
const uint32_t PACKET_MAGIC=0x414C4431;
struct Packet { uint32_t magic; uint32_t counter; uint8_t state; };
portMUX_TYPE radioMux=portMUX_INITIALIZER_UNLOCKED;
Packet received={};
uint8_t senderMac[6]={};
bool packetPending=false;
bool radioReady=false;
uint32_t sequence=0;
// Wi-Fi 回调只拷贝校验过的数据；串口与输出都留给 loop。
void onReceive(const esp_now_recv_info_t *info,const uint8_t *data,int length) {
  if (!info || length!=sizeof(Packet)) return;
  Packet incoming; memcpy(&incoming,data,sizeof(incoming));
  if (incoming.magic!=PACKET_MAGIC || incoming.state>1) return;
  portENTER_CRITICAL(&radioMux); received=incoming; memcpy(senderMac,info->src_addr,6); packetPending=true; portEXIT_CRITICAL(&radioMux);
}
bool startRadio() {
  if (esp_now_init()!=ESP_OK) return false;
  if (esp_now_register_recv_cb(onReceive)!=ESP_OK) return false;
  esp_now_peer_info_t peer={}; memcpy(peer.peer_addr,BROADCAST,6); peer.channel=RADIO_CHANNEL; peer.encrypt=false; peer.ifidx=WIFI_IF_STA;
  return esp_now_add_peer(&peer)==ESP_OK;
}
bool takePacket(Packet &packet,uint8_t *mac) {
  portENTER_CRITICAL(&radioMux); const bool pending=packetPending;
  if (pending) { packet=received; memcpy(mac,senderMac,6); packetPending=false; }
  portEXIT_CRITICAL(&radioMux); return pending;
}
void broadcastState(bool state) {
  const Packet packet={PACKET_MAGIC,++sequence,uint8_t(state)};
  if (radioReady && esp_now_send(BROADCAST,reinterpret_cast<const uint8_t*>(&packet),sizeof(packet))!=ESP_OK) Serial.println("ESP-NOW 发送失败");
}
const int LED_PIN=41;
unsigned long lastSend=0, flashAt=0;
bool flashing=false;
void setup() {
  Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW);
  WiFi.mode(WIFI_STA); WiFi.disconnect();
  if (esp_wifi_set_channel(RADIO_CHANNEL,WIFI_SECOND_CHAN_NONE)!=ESP_OK) { Serial.println("设置信道失败"); return; }
  radioReady=startRadio(); if (!radioReady) Serial.println("ESP-NOW 初始化失败");
  Serial.println(WiFi.macAddress());
}
void loop() {
  const unsigned long now=millis(); Packet packet; uint8_t mac[6];
  if (takePacket(packet,mac)) {
    Serial.printf("%02X:%02X:%02X:%02X:%02X:%02X count=%lu state=%u\n",mac[0],mac[1],mac[2],mac[3],mac[4],mac[5],(unsigned long)packet.counter,packet.state);
    digitalWrite(LED_PIN,HIGH); flashAt=now; flashing=true;
  }
  if (flashing && now-flashAt>=100) { flashing=false; digitalWrite(LED_PIN,LOW); }
  if (radioReady && now-lastSend>=2000) { lastSend=now; broadcastState((sequence%2)==0); }
}
