// 10 · 热点网页与 ESP-NOW 离线中枢
// 接线：两块 ESP32-S3，各接 LED41 串电阻；手机只连接其中一块的热点。两板烧录同一代码。
// 当前诊断板型：esp32:esp32:esp32s3
// 适用板型：ESP32-S3 / Arduino-ESP32 3.x
// 依赖库：开发板核心自带
// 来源：10-1 WIF理论与实战.pptx 第 23 页
// 预期现象：手机通过独立热点网页控灯；状态广播给另一块板并更新 LED。收到状态不会再次广播，避免回环。
// 示例引脚需要按你的板卡原理图调整；不会自动上传。
// 可改参数：AP_PASSWORD（至少 8 位）；RADIO_CHANNEL = 6；LED_PIN = 41
// 注意：两块板热点名称按 MAC 区分；局域网实验，无公网服务或鉴权。连接 AP 后不要另接不同信道的路由器。ESP-NOW 广播丢包时可再次切换。

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
#include <WebServer.h>
const int LED_PIN=41;
WebServer web(80);
bool ledOn=false;
const char PAGE[] PROGMEM=R"HTML(<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Arduino LED</title>
<h1>LED 实验</h1><p id="status">正在读取</p><button onclick="setLed(1)">点亮</button><button onclick="setLed(0)">熄灭</button>
<script>async function refresh(){try{const r=await fetch('/getled');if(!r.ok)throw Error();const d=await r.json();document.getElementById('status').textContent=d.state?'已点亮':'已熄灭';}catch(e){document.getElementById('status').textContent='连接失败，请重试';}}
async function setLed(v){try{const r=await fetch('/setled?val='+v,{method:'POST'});if(!r.ok)throw Error();await refresh();}catch(e){document.getElementById('status').textContent='控制失败，请重试';}}refresh();</script>)HTML";
void sendState() { web.send(200,"application/json",ledOn ? R"JSON({"state":1})JSON" : R"JSON({"state":0})JSON"); }
void registerRoutes() {
  web.on("/",HTTP_GET,[](){ web.send_P(200,"text/html; charset=utf-8",PAGE); });
  web.on("/getled",HTTP_GET,sendState);
  web.on("/setled",HTTP_POST,[](){
    const String value=web.arg("val");
    if (value!="0" && value!="1") { web.send(400,"text/plain","val must be 0 or 1"); return; }
    ledOn=value=="1"; digitalWrite(LED_PIN,ledOn ? HIGH : LOW); sendState();
  });
  web.onNotFound([](){web.send(404,"text/plain","Not found");});
}
const char *AP_PASSWORD="ChangeMe123"; // 实验前修改，至少 8 位
unsigned long lastState=0;
bool previousState=false;
void setup() {
  Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW);
  WiFi.mode(WIFI_AP_STA);
  String apName="ArduinoLab-"+WiFi.macAddress(); apName.replace(":","");
  if (!WiFi.softAP(apName.c_str(),AP_PASSWORD,RADIO_CHANNEL)) { Serial.println("热点启动失败"); return; }
  radioReady=startRadio(); if (!radioReady) Serial.println("ESP-NOW 初始化失败");
  registerRoutes(); web.begin(); Serial.println(apName); Serial.print("http://"); Serial.println(WiFi.softAPIP());
}
void loop() {
  web.handleClient();
  if (ledOn!=previousState) { previousState=ledOn; broadcastState(ledOn); }
  Packet packet; uint8_t mac[6];
  if (takePacket(packet,mac)) { ledOn=packet.state; previousState=ledOn; digitalWrite(LED_PIN,ledOn ? HIGH : LOW); }
  // 不做周期双向覆盖，防止两块板各自旧状态互相覆盖。
}
