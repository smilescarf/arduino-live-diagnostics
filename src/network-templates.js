'use strict';
const { add } = require('./course-templates');
const sta = `#include <WiFi.h>
// 只填你有权使用的 2.4GHz 网络；请勿把真实密码提交 GitHub。
const char *WIFI_SSID="YOUR_WIFI_SSID";
const char *WIFI_PASSWORD="YOUR_WIFI_PASSWORD";
`;
add('WifiScanConnect', '10 · Wi-Fi 扫描与限时入网', 14, [12,13], 'ESP32-S3 与 USB 数据线，无外接器件；串口 115200。',
  ['WIFI_SSID', 'WIFI_PASSWORD', 'CONNECT_TIMEOUT_MS = 15000'],
  '异步扫描 2.4GHz 网络，随后尝试入网；成功打印 IP/RSSI，失败提示检查信息，不会永远等待。', sta + `const unsigned long CONNECT_TIMEOUT_MS=15000;
int stage=0;
unsigned long started=0;
void setup() { Serial.begin(115200); WiFi.mode(WIFI_STA); WiFi.scanNetworks(true); started=millis(); }
void loop() {
  const unsigned long now=millis();
  if (stage==0) {
    const int n=WiFi.scanComplete();
    if (n>=0 || now-started>=15000) {
      for (int i=0; i<n; ++i) Serial.printf("%s %d dBm\\n",WiFi.SSID(i).c_str(),WiFi.RSSI(i));
      WiFi.scanDelete();
      if (String(WIFI_SSID)=="YOUR_WIFI_SSID") { Serial.println("请先填写 Wi-Fi 名称和密码"); stage=3; return; }
      WiFi.begin(WIFI_SSID,WIFI_PASSWORD); started=now; stage=1;
    } else if (n==WIFI_SCAN_FAILED) { Serial.println("扫描失败，请复位重试"); stage=3; }
  } else if (stage==1) {
    if (WiFi.status()==WL_CONNECTED) { Serial.print("IP: "); Serial.println(WiFi.localIP()); Serial.println(WiFi.RSSI()); stage=2; }
    else if (now-started>=CONNECT_TIMEOUT_MS) { WiFi.disconnect(); Serial.println("入网超时：检查 2.4GHz/名称/密码"); stage=3; }
  }
}
`);
add('WifiTcpLed', '10 · TCP 按行指令控灯', 14, [14,15,16,17], 'LED41 经 1kΩ 接地；电脑和 ESP32 接入同一个 2.4GHz 局域网。',
  ['WIFI_SSID', 'WIFI_PASSWORD', 'TCP_PORT = 8080', 'LED_PIN = 41'],
  '电脑连接串口输出的 IP:8080，发送 ON 或 OFF 并带换行；收到状态回复。支持拆包、粘包和超长行拒绝。', sta + `const int LED_PIN=41, TCP_PORT=8080;
WiFiServer server(TCP_PORT);
WiFiClient client;
char line[65];
size_t used=0;
bool discarding=false, started=false, timedOut=false;
unsigned long connectedAt=0, lastRx=0;
void setup() {
  Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW);
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID,WIFI_PASSWORD); connectedAt=millis();
}
void loop() {
  const unsigned long now=millis();
  if (WiFi.status()!=WL_CONNECTED) {
    if (!timedOut && now-connectedAt>15000) { Serial.println("Wi-Fi 入网超时，请检查凭据并复位"); WiFi.disconnect(); timedOut=true; }
    if (client) client.stop(); return;
  }
  if (!started) { server.begin(); started=true; Serial.print("TCP IP: "); Serial.println(WiFi.localIP()); }
  WiFiClient incoming=server.accept();
  if (incoming) {
    if (client && client.connected()) { incoming.println("BUSY"); incoming.stop(); }
    else { client=incoming; used=0; discarding=false; lastRx=now; client.println("Send ON or OFF + newline"); }
  }
  for (int budget=0; client && client.available() && budget<128; ++budget) {
    const char c=char(client.read()); lastRx=now;
    if (c=='\\r') continue;
    if (c=='\\n') {
      if (discarding) client.println("ERROR: line too long");
      else {
        line[used]='\\0';
        if (!strcmp(line,"ON")) { digitalWrite(LED_PIN,HIGH); client.println("OK ON"); }
        else if (!strcmp(line,"OFF")) { digitalWrite(LED_PIN,LOW); client.println("OK OFF"); }
        else client.println("ERROR: use ON/OFF");
      }
      used=0; discarding=false;
    } else if (used<sizeof(line)-1 && !discarding) line[used++]=c;
    else discarding=true;
  }
  if (client && now-lastRx>30000) { client.stop(); used=0; discarding=false; }
}
`, { level:'进阶', notes:['IP 由路由器 DHCP 分配，以串口为准；同一客户端空闲 30 秒关闭。入网失败后修正凭据并复位。'] });

const page = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Arduino LED</title>
<h1>LED 实验</h1><p id="status">正在读取</p><button onclick="setLed(1)">点亮</button><button onclick="setLed(0)">熄灭</button>
<script>async function refresh(){try{const r=await fetch('/getled');if(!r.ok)throw Error();const d=await r.json();document.getElementById('status').textContent=d.state?'已点亮':'已熄灭';}catch(e){document.getElementById('status').textContent='连接失败，请重试';}}
async function setLed(v){try{const r=await fetch('/setled?val='+v,{method:'POST'});if(!r.ok)throw Error();await refresh();}catch(e){document.getElementById('status').textContent='控制失败，请重试';}}refresh();</script>`;
const web = `#include <WebServer.h>
const int LED_PIN=41;
WebServer web(80);
bool ledOn=false;
const char PAGE[] PROGMEM=R"HTML(${page})HTML";
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
`;
add('WifiWebLed', '10 · 网页控灯与 JSON 局部刷新', 14, [18,19,20], 'LED41 经 1kΩ 接地；手机/电脑与开发板连同一局域网。',
  ['WIFI_SSID', 'WIFI_PASSWORD', 'LED_PIN = 41'],
  '浏览器打开串口显示的 http://IP，按钮通过 fetch 控灯；页面显示设备返回的实际状态。', sta + web + `bool started=false, timedOut=false;
unsigned long startedAt=0;
void setup() {
  Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW); registerRoutes();
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID,WIFI_PASSWORD); startedAt=millis();
}
void loop() {
  if (WiFi.status()==WL_CONNECTED) {
    if (!started) { started=true; web.begin(); Serial.print("http://"); Serial.println(WiFi.localIP()); }
    web.handleClient();
  } else if (!timedOut && millis()-startedAt>15000) { timedOut=true; WiFi.disconnect(); Serial.println("入网超时，请检查凭据并复位"); }
}
`, { level:'进阶', notes:['用于可信局域网内的低压 LED 实验；未实现用户鉴权，不要映射到公网。WebServer 请求处理存在有界等待。'] });

const nowCode = `#include <esp_now.h>
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
`;
add('EspNowChat', '10 · ESP-NOW 双板广播与状态收发', 14, [21,22], '两块 ESP32-S3 烧录同一代码；各接 LED41（串电阻）和 USB 串口。无需路由器。',
  ['RADIO_CHANNEL = 6', 'SEND_INTERVAL_MS = 2000'],
  '每 2 秒广播计数和状态；收到后闪灯并打印发送者 MAC。双方须使用相同协议与信道。', `#include <WiFi.h>
` + nowCode + `const int LED_PIN=41;
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
    Serial.printf("%02X:%02X:%02X:%02X:%02X:%02X count=%lu state=%u\\n",mac[0],mac[1],mac[2],mac[3],mac[4],mac[5],(unsigned long)packet.counter,packet.state);
    digitalWrite(LED_PIN,HIGH); flashAt=now; flashing=true;
  }
  if (flashing && now-flashAt>=100) { flashing=false; digitalWrite(LED_PIN,LOW); }
  if (radioReady && now-lastSend>=2000) { lastSend=now; broadcastState((sequence%2)==0); }
}
`, { level:'进阶', notes:['固定长度实验协议，不保证每包送达；收到多包时保留最新一包。广播未加密，勿传输敏感信息。'] });
add('OfflineControlHub', '10 · 热点网页与 ESP-NOW 离线中枢', 14, [23], '两块 ESP32-S3，各接 LED41 串电阻；手机只连接其中一块的热点。两板烧录同一代码。',
  ['AP_PASSWORD（至少 8 位）', 'RADIO_CHANNEL = 6', 'LED_PIN = 41'],
  '手机通过独立热点网页控灯；状态广播给另一块板并更新 LED。收到状态不会再次广播，避免回环。', `#include <WiFi.h>
` + nowCode + web + `const char *AP_PASSWORD="ChangeMe123"; // 实验前修改，至少 8 位
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
`, { level:'综合', notes:['两块板热点名称按 MAC 区分；局域网实验，无公网服务或鉴权。连接 AP 后不要另接不同信道的路由器。ESP-NOW 广播丢包时可再次切换。'] });

const ble = `#include <BLEDevice.h>
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
`;
add('BleConnect', '11 · BLE 广播、连接与重连', 15, [9], 'ESP32-S3 与手机 BLE 调试工具（例如 nRF Connect）；无需外部器件。',
  ['DEVICE_NAME = ArduinoLab-BLE', 'SERVICE_UUID'],
  '手机扫描到设备并连接；串口显示状态变化；断开后重新广播。', ble + `void setup() {
  Serial.begin(115200); BLEDevice::init("ArduinoLab-BLE");
  BLEServer *server=BLEDevice::createServer(); server->setCallbacks(new ConnectionCallbacks());
  BLEService *service=server->createService(SERVICE_UUID); service->start();
  BLEDevice::getAdvertising()->addServiceUUID(SERVICE_UUID); BLEDevice::startAdvertising();
}
void loop() {
  pollAdvertising(); static bool previous=false;
  const bool current=connected.load(); if (current!=previous) { previous=current; Serial.println(current ? "手机已连接" : "手机已断开"); }
}
`);
add('BleGattLed', '11 · GATT 控灯与传感器通知', 15, [10,11,12], 'LED41 经电阻接地；可选电位器中间脚接 GPIO1，两端 3.3V/GND；手机使用 BLE 调试工具。',
  ['LED_PIN = 41', 'ADC_PIN = 1', 'SENSOR_UUID / LED_UUID'],
  '向 LED 特征写入文本 1/0 控灯；订阅传感器特征后每 2 秒收到 ADC 原始值；READ 也能读取。', ble + `const char *LED_UUID="4fafc202-1fb5-459e-8fcc-c5c9c331914b";
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
`, { level:'进阶', notes:['写入格式为 UTF-8/文本字符 1 或 0（十六进制 31/30），不是二进制 01/00；先订阅通知。全部使用自定义 128 位 UUID。'] });

add('BleShortcutKeyboard', '11 · 三按键 BLE 复制粘贴剪切键盘', 15, [14], '3 个按键分别接 GPIO39、40、41 与 GND；内部上拉。通过电脑系统蓝牙设置配对 ArduinoLab-Keys。',
  ['KEY_PINS = {39,40,41}', 'CTRL_MODIFIER = 0x01（Windows/Linux）'],
  '只在实体按键按下后发送 Ctrl+C、Ctrl+V、Ctrl+X，并自动松开；先在空白文本编辑器中测试。', ble + `#include <BLEHIDDevice.h>
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
`, { level:'综合', notes:['使用 ESP32 核心内置 BLEHIDDevice 实现同一作业，避免旧版 ESP32-BLE-Keyboard 的核心兼容问题；支持配对的主机系统仍须实机验证。更改报告后系统可能需要删除旧配对再连接。'] });

add('DigitalSensorCounter', '拓展 · 光电/数字霍尔去抖计数', null, [],
  '带数字输出的 3.3V 兼容光电或霍尔模块，OUT→GPIO7、GND 共地，按模块规格供电；开漏输出使用 3.3V 上拉。不是直接连接裸光电二极管。',
  ['SENSOR_PIN = 7', 'ACTIVE_LEVEL = LOW', 'STABLE_MS = 5'],
  '遮挡或磁铁靠近时计数一次，串口观察；适合慢速教学，非高速转速计。', `const int SENSOR_PIN=7, ACTIVE_LEVEL=LOW;
const unsigned long STABLE_MS=5;
int raw=HIGH, stable=HIGH;
unsigned long changedAt=0, count=0;
void setup() { Serial.begin(115200); pinMode(SENSOR_PIN,INPUT_PULLUP); raw=stable=digitalRead(SENSOR_PIN); }
void loop() {
  const unsigned long now=millis(); const int value=digitalRead(SENSOR_PIN);
  if (value!=raw) { raw=value; changedAt=now; }
  if (value!=stable && now-changedAt>=STABLE_MS) { stable=value; if (stable==ACTIVE_LEVEL) Serial.println(++count); }
}
`, { notes:['补充实现：所提供 9-1 文件内文与超声波/舵机章节重复，未从该文件虚构接线或实验要求。'] });
add('TrafficLights', '拓展 · 红绿灯状态机', null, [], '红、黄、绿 LED 经各自 1kΩ 分别接 GPIO39、40、41，负极接地。',
  ['PINS = {39,40,41}', 'DURATIONS（红/绿/黄）= {5000,5000,1000}'],
  '红 5 秒→绿 5 秒→黄 1 秒；用状态与时间表驱动，不靠多段 delay。', `const int PINS[]={39,40,41};
const uint8_t ORDER[]={0,2,1};
const unsigned long DURATIONS[]={5000,5000,1000};
uint8_t phase=0;
unsigned long changedAt=0;
void setup() { for (int pin:PINS) { pinMode(pin,OUTPUT); digitalWrite(pin,LOW); } digitalWrite(PINS[ORDER[0]],HIGH); }
void loop() {
  const unsigned long now=millis(); if (now-changedAt<DURATIONS[phase]) return;
  digitalWrite(PINS[ORDER[phase]],LOW); phase=(phase+1)%3; changedAt=now; digitalWrite(PINS[ORDER[phase]],HIGH);
}
`);
add('SerialLedConsole', '拓展 · 串口指令调试台', null, [], 'LED41 经 1kΩ 接地；串口监视器 115200，发送行尾选择换行。',
  ['LED_PIN = 41', 'BUFFER_SIZE = 32'],
  '发送 ON/OFF/STATUS，看到明确回复；超长行整行拒绝，便于理解指令边界。', `const int LED_PIN=41;
char line[32]; size_t used=0; bool overflow=false, on=false;
void setup() { Serial.begin(115200); pinMode(LED_PIN,OUTPUT); digitalWrite(LED_PIN,LOW); }
void loop() {
  for (int budget=0;Serial.available() && budget<64;++budget) {
    const char c=char(Serial.read()); if (c=='\\r') continue;
    if (c=='\\n') {
      line[used]='\\0';
      if (overflow) Serial.println("指令太长");
      else if (!strcmp(line,"ON")) { on=true; Serial.println("OK ON"); }
      else if (!strcmp(line,"OFF")) { on=false; Serial.println("OK OFF"); }
      else if (!strcmp(line,"STATUS")) Serial.println(on ? "ON" : "OFF");
      else Serial.println("支持 ON / OFF / STATUS");
      digitalWrite(LED_PIN,on ? HIGH : LOW); used=0; overflow=false;
    } else if (!overflow && used<sizeof(line)-1) line[used++]=c; else overflow=true;
  }
}
`);
